import pg from "pg";
import { money, type ShippingRate } from "../../../../packages/commerce-core/src/index.js";
import {
  CheckoutError,
  type CheckoutOrder,
  type CheckoutProduct,
  type CheckoutRepository,
  type CheckoutResult,
} from "./service.js";

type Queryable = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

const integer = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid database integer: ${field}`);
  return parsed;
};

const optionalInteger = (value: unknown, field: string): number | undefined =>
  value === null || value === undefined ? undefined : integer(value, field);

const optionalDate = (value: unknown): Date | undefined =>
  value === null || value === undefined ? undefined : new Date(String(value));

export class PostgresCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly unitTaxMinor = 0,
  ) {
    if (!Number.isSafeInteger(unitTaxMinor) || unitTaxMinor < 0) {
      throw new Error("Checkout tax fixture must be a non-negative integer in minor units.");
    }
  }

  async getProduct(slug: string): Promise<CheckoutProduct | undefined> {
    const result = await this.pool.query(
      `SELECT p.id, p.sku, p.slug, p.name, p.status, p.price_minor, p.currency,
              p.shipping_weight_grams,
              COALESCE(sum(i.available_quantity - i.reserved_quantity - i.safety_stock), 0) AS available_quantity
         FROM products p
         LEFT JOIN inventory_levels i ON i.product_id = p.id
        WHERE p.slug = $1 AND p.status IN ('private', 'active')
        GROUP BY p.id`,
      [slug],
    );
    if (result.rowCount !== 1) return undefined;
    const row = result.rows[0];
    if (row.shipping_weight_grams === null) return undefined;
    return Object.freeze({
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      name: row.name,
      status: row.status,
      priceMinor: integer(row.price_minor, "product price"),
      unitTaxMinor: this.unitTaxMinor,
      currency: row.currency,
      shippingWeightGrams: integer(row.shipping_weight_grams, "shipping weight"),
      availableQuantity: Math.max(0, integer(row.available_quantity, "available quantity")),
    });
  }

  async getShipping(destinationCountry: string) {
    const countryCode = destinationCountry.trim().toUpperCase();
    const destination = await this.pool.query(
      `SELECT c.country_code, c.destination_status, z.id AS zone_id, z.zone_key
         FROM shipping_zone_countries c
         JOIN shipping_zones z ON z.id = c.zone_id
        WHERE c.country_code = $1 AND z.status IN ('test', 'active')`,
      [countryCode],
    );
    if (destination.rowCount !== 1) return undefined;
    const destinationRow = destination.rows[0];
    const rates = await this.pool.query(
      `SELECT r.id, z.zone_key, r.country_code, m.method_key, m.name AS method_name,
              r.rate_minor, r.currency, r.status, r.minimum_order_minor,
              r.maximum_order_minor, r.minimum_weight_grams, r.maximum_weight_grams,
              r.free_shipping_threshold_minor, r.effective_from, r.effective_to
         FROM shipping_rates r
         JOIN shipping_zones z ON z.id = r.zone_id
         JOIN shipping_methods m ON m.id = r.shipping_method_id
        WHERE r.zone_id = $1
          AND (r.country_code IS NULL OR r.country_code = $2)
          AND r.status IN ('test', 'active')
          AND m.status IN ('test', 'active')`,
      [destinationRow.zone_id, countryCode],
    );
    return Object.freeze({
      destination: Object.freeze({
        countryCode: destinationRow.country_code,
        zoneKey: destinationRow.zone_key,
        status: destinationRow.destination_status,
      }),
      rates: Object.freeze(rates.rows.map((row): ShippingRate => Object.freeze({
        id: row.id,
        zoneKey: row.zone_key,
        ...(row.country_code ? { countryCode: row.country_code } : {}),
        methodKey: row.method_key,
        methodName: row.method_name,
        price: money(integer(row.rate_minor, "shipping rate"), row.currency),
        status: row.status,
        ...(optionalInteger(row.minimum_order_minor, "minimum order") !== undefined
          ? { minimumSubtotal: integer(row.minimum_order_minor, "minimum order") } : {}),
        ...(optionalInteger(row.maximum_order_minor, "maximum order") !== undefined
          ? { maximumSubtotal: integer(row.maximum_order_minor, "maximum order") } : {}),
        ...(optionalInteger(row.minimum_weight_grams, "minimum weight") !== undefined
          ? { minimumWeightGrams: integer(row.minimum_weight_grams, "minimum weight") } : {}),
        ...(optionalInteger(row.maximum_weight_grams, "maximum weight") !== undefined
          ? { maximumWeightGrams: integer(row.maximum_weight_grams, "maximum weight") } : {}),
        ...(optionalInteger(row.free_shipping_threshold_minor, "free shipping threshold") !== undefined
          ? { freeShippingThreshold: integer(row.free_shipping_threshold_minor, "free shipping threshold") } : {}),
        effectiveFrom: new Date(row.effective_from),
        ...(optionalDate(row.effective_to) ? { effectiveTo: new Date(row.effective_to) } : {}),
      }))),
    });
  }

  async findCheckout(idempotencyKey: string, fingerprint: string): Promise<CheckoutResult | undefined> {
    const result = await this.pool.query(
      `SELECT s.request_fingerprint, s.state, s.checkout_url,
              o.id AS order_id, o.order_number, o.status
         FROM checkout_sessions s
         LEFT JOIN orders o ON o.id = s.order_id
        WHERE s.idempotency_key = $1`,
      [idempotencyKey],
    );
    if (result.rowCount === 0) return undefined;
    const row = result.rows[0];
    if (row.request_fingerprint !== fingerprint) {
      throw new CheckoutError("conflict", "This checkout key was already used for another request.");
    }
    if (row.state !== "complete" || row.status !== "pending_payment" || !row.checkout_url) {
      throw new CheckoutError("conflict", "This checkout request is already being processed.");
    }
    return Object.freeze({
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: "pending_payment",
      checkoutUrl: row.checkout_url,
      replayed: true,
    });
  }

  async createOrder(order: CheckoutOrder, idempotencyKey: string, fingerprint: string): Promise<void> {
    await this.transaction(async (client) => {
      const reservation = await client.query(
        `INSERT INTO checkout_sessions (idempotency_key, request_fingerprint)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING idempotency_key`,
        [idempotencyKey, fingerprint],
      );
      if (reservation.rowCount !== 1) {
        throw new CheckoutError("conflict", "This checkout request is already being processed.");
      }
      const customer = await client.query(
        `INSERT INTO customers (email_normalised, email_display)
         VALUES ($1, $1)
         ON CONFLICT (email_normalised) DO UPDATE SET email_display = EXCLUDED.email_display
         RETURNING id`,
        [order.email],
      );
      const customerId = customer.rows[0].id;
      await client.query(
        `INSERT INTO addresses
          (customer_id, recipient_name, line_1, line_2, locality, region, postal_code, country_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [customerId, order.deliveryAddress.recipientName, order.deliveryAddress.line1,
          order.deliveryAddress.line2 ?? null, order.deliveryAddress.locality,
          order.deliveryAddress.region ?? null, order.deliveryAddress.postalCode,
          order.deliveryAddress.countryCode],
      );
      const shipping = await this.shippingSnapshot(client, order.shippingRateId, order.deliveryAddress.countryCode);
      await client.query(
        `INSERT INTO orders
          (id, order_number, customer_id, status, currency, subtotal_minor, tax_minor,
           delivery_minor, total_minor, delivery_address_snapshot, shipping_rate_id,
           shipping_country_code, shipping_method_snapshot, shipping_rate_snapshot)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb)`,
        [order.id, order.orderNumber, customerId, order.currency, order.subtotalMinor,
          order.taxMinor, order.deliveryMinor, order.totalMinor,
          JSON.stringify(order.deliveryAddress), order.shippingRateId,
          order.deliveryAddress.countryCode, JSON.stringify(shipping.method), JSON.stringify(shipping.rate)],
      );
      await client.query(
        `INSERT INTO order_items
          (order_id, product_id, sku_snapshot, name_snapshot, unit_price_minor,
           unit_weight_grams, quantity, tax_minor, line_total_minor)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [order.id, order.product.id, order.product.sku, order.product.name,
          order.product.priceMinor, order.product.shippingWeightGrams, order.quantity,
          order.taxMinor, order.subtotalMinor + order.taxMinor],
      );
      await client.query(
        `UPDATE checkout_sessions SET order_id = $2 WHERE idempotency_key = $1`,
        [idempotencyKey, order.id],
      );
    });
  }

  async attachPayment(input: Readonly<{
    orderId: string;
    provider: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    checkoutUrl: string;
  }>): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        `INSERT INTO payments
          (order_id, provider, provider_payment_id, status, amount_minor, currency, idempotency_key)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
        [input.orderId, input.provider, input.providerPaymentId, input.amountMinor,
          input.currency, input.idempotencyKey],
      );
      const order = await client.query(
        `UPDATE orders SET status = 'pending_payment'
          WHERE id = $1 AND status = 'draft'
          RETURNING id`,
        [input.orderId],
      );
      if (order.rowCount !== 1) throw new Error("Order was not in the draft state.");
      const session = await client.query(
        `UPDATE checkout_sessions
            SET state = 'complete', checkout_url = $3
          WHERE idempotency_key = $1 AND order_id = $2 AND state = 'reserved'
          RETURNING idempotency_key`,
        [input.idempotencyKey, input.orderId, input.checkoutUrl],
      );
      if (session.rowCount !== 1) throw new Error("Checkout session was not reserved.");
    });
  }

  async abandonOrder(orderId: string): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        `UPDATE orders SET status = 'cancelled', cancelled_at = now()
          WHERE id = $1 AND status = 'draft'`,
        [orderId],
      );
      await client.query(
        `UPDATE checkout_sessions
            SET state = 'failed', failure_code = 'provider_error'
          WHERE order_id = $1 AND state = 'reserved'`,
        [orderId],
      );
    });
  }

  private async shippingSnapshot(client: Queryable, rateId: string, countryCode: string) {
    const result = await client.query(
      `SELECT m.method_key, m.name, m.description, r.rate_minor, r.currency,
              r.version, r.country_code, z.zone_key
         FROM shipping_rates r
         JOIN shipping_methods m ON m.id = r.shipping_method_id
         JOIN shipping_zones z ON z.id = r.zone_id
        WHERE r.id = $1 AND (r.country_code IS NULL OR r.country_code = $2)`,
      [rateId, countryCode],
    );
    if (result.rowCount !== 1) throw new CheckoutError("unavailable", "Shipping is no longer available.");
    const row = result.rows[0];
    return {
      method: { key: row.method_key, name: row.name, description: row.description },
      rate: {
        amountMinor: integer(row.rate_minor, "shipping rate"), currency: row.currency,
        version: row.version, zoneKey: row.zone_key, countryCode: row.country_code,
      },
    };
  }

  private async transaction<Result>(work: (client: pg.PoolClient) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
