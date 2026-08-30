import pg from "pg";
import {
  orderFulfilmentStatusFor,
  transitionFulfilment,
  type CreateFulfilmentRequest,
  type FulfilmentProviderEvent,
  type FulfilmentStatus,
} from "../../../../packages/commerce-core/src/index.js";
import { FulfilmentError, type FulfilmentRepository } from "./service.js";

const address = (value: Record<string, unknown>): CreateFulfilmentRequest["deliveryAddress"] => Object.freeze({
  recipientName: String(value.recipientName ?? ""), line1: String(value.line1 ?? ""),
  ...(value.line2 ? { line2: String(value.line2) } : {}), locality: String(value.locality ?? ""),
  ...(value.region ? { region: String(value.region) } : {}), postalCode: String(value.postalCode ?? ""),
  countryCode: String(value.countryCode ?? ""), ...(value.phone ? { phone: String(value.phone) } : {}),
});

export class PostgresFulfilmentRepository implements FulfilmentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async reservePaidOrder(orderId: string, provider: string, idempotencyKey: string, correlationId: string) {
    return this.transaction(async (client) => {
      const orderResult = await client.query(`
        SELECT o.id, o.order_number, o.status, o.fulfilment_status, o.delivery_address_snapshot,
               EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'captured') AS captured
          FROM orders o WHERE o.id = $1 FOR UPDATE`, [orderId]);
      if (orderResult.rowCount !== 1) throw new FulfilmentError("not_found", "The order was not found.");
      const order = orderResult.rows[0];
      if (order.status !== "paid" || order.captured !== true) {
        throw new FulfilmentError("not_paid", "Only an order with a verified captured payment can be fulfilled.");
      }
      const linesResult = await client.query(`
        SELECT COALESCE(p.fulfilment_sku, oi.sku_snapshot) AS sku, oi.quantity
          FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 ORDER BY oi.created_at`, [orderId]);
      const request: CreateFulfilmentRequest = Object.freeze({
        idempotencyKey, orderId: order.id, orderNumber: order.order_number,
        deliveryAddress: address(order.delivery_address_snapshot),
        lines: Object.freeze(linesResult.rows.map((line) => Object.freeze({ sku: line.sku, quantity: line.quantity }))),
      });
      const inserted = await client.query(`
        INSERT INTO fulfilments (order_id, provider, status, idempotency_key, request_snapshot)
        VALUES ($1, $2, 'created', $3, $4::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [orderId, provider, idempotencyKey, JSON.stringify(request)]);
      if (inserted.rowCount !== 1) {
        const existing = await client.query("SELECT id, provider_reference FROM fulfilments WHERE idempotency_key = $1", [idempotencyKey]);
        return Object.freeze({ outcome: "duplicate" as const, fulfilmentId: existing.rows[0].id, request, ...(existing.rows[0].provider_reference ? { providerReference: existing.rows[0].provider_reference } : {}) });
      }
      await client.query("UPDATE orders SET fulfilment_status = 'queued' WHERE id = $1", [orderId]);
      await this.audit(client, "fulfilment", inserted.rows[0].id, "fulfilment.reserved", correlationId, { orderId });
      return Object.freeze({ outcome: "reserved" as const, fulfilmentId: inserted.rows[0].id, request });
    });
  }

  async confirmProviderCreation(input: Readonly<{ fulfilmentId: string; providerReference: string; status: "queued" | "accepted"; correlationId: string }>) {
    await this.transaction(async (client) => {
      const result = await client.query(`UPDATE fulfilments SET provider_reference = $2, status = $3
        WHERE id = $1 AND status = 'created' RETURNING order_id`, [input.fulfilmentId, input.providerReference, input.status]);
      if (result.rowCount !== 1) throw new Error("Fulfilment reservation was not available.");
      await client.query("UPDATE orders SET fulfilment_status = $2 WHERE id = $1", [result.rows[0].order_id, orderFulfilmentStatusFor(input.status)]);
      await this.audit(client, "fulfilment", input.fulfilmentId, "fulfilment.created", input.correlationId, { providerReference: input.providerReference });
    });
  }

  async failProviderCreation(fulfilmentId: string, failureCode: string, correlationId: string) {
    await this.transaction(async (client) => {
      const result = await client.query("UPDATE fulfilments SET status = 'failed', failure_code = $2 WHERE id = $1 AND status = 'created' RETURNING order_id", [fulfilmentId, failureCode]);
      if (result.rowCount === 1) {
        await client.query("UPDATE orders SET fulfilment_status = 'manual_review' WHERE id = $1", [result.rows[0].order_id]);
        await this.audit(client, "fulfilment", fulfilmentId, "fulfilment.failed", correlationId, { failureCode });
      }
    });
  }

  async getFulfilment(providerReference: string) {
    const result = await this.pool.query("SELECT status FROM fulfilments WHERE provider_reference = $1", [providerReference]);
    return result.rowCount === 1 ? Object.freeze({ status: result.rows[0].status as FulfilmentStatus }) : undefined;
  }

  async applyProviderEvent(provider: string, event: FulfilmentProviderEvent, correlationId: string) {
    return this.transaction(async (client) => {
      const fulfilmentResult = await client.query("SELECT id, order_id, status FROM fulfilments WHERE provider = $1 AND provider_reference = $2 FOR UPDATE", [provider, event.providerReference]);
      if (fulfilmentResult.rowCount !== 1) throw new FulfilmentError("not_found", "The fulfilment reference was not found.");
      const fulfilment = fulfilmentResult.rows[0];
      const receipt = await client.query(`INSERT INTO fulfilment_events
        (provider, provider_event_id, fulfilment_id, target_status, correlation_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
      [provider, event.eventId, fulfilment.id, event.status, correlationId, JSON.stringify(event)]);
      if (receipt.rowCount !== 1) return "duplicate" as const;
      const transition = transitionFulfilment(fulfilment.status, event.status);
      if (transition.outcome !== "applied") {
        await client.query("UPDATE fulfilment_events SET processing_status = $2, processed_at = now() WHERE id = $1", [receipt.rows[0].id, transition.outcome]);
        if (transition.outcome === "requires_review") await client.query("UPDATE orders SET fulfilment_status = 'manual_review' WHERE id = $1", [fulfilment.order_id]);
        return transition.outcome;
      }
      await client.query(`UPDATE fulfilments SET status = $2, tracking_carrier = COALESCE($3, tracking_carrier),
        tracking_reference = COALESCE($4, tracking_reference), failure_code = COALESCE($5, failure_code),
        dispatched_at = CASE WHEN $2 = 'dispatched' THEN COALESCE(dispatched_at, now()) ELSE dispatched_at END,
        delivered_at = CASE WHEN $2 = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
        cancelled_at = CASE WHEN $2 = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
        returned_at = CASE WHEN $2 = 'returned' THEN COALESCE(returned_at, now()) ELSE returned_at END WHERE id = $1`,
      [fulfilment.id, transition.status, event.trackingCarrier ?? null, event.trackingReference ?? null, event.failureCode ?? null]);
      const orderStatus = transition.status === "failed" ? "manual_review" : orderFulfilmentStatusFor(transition.status);
      await client.query("UPDATE orders SET fulfilment_status = $2 WHERE id = $1", [fulfilment.order_id, orderStatus]);
      await client.query("UPDATE fulfilment_events SET processing_status = 'processed', processed_at = now() WHERE id = $1", [receipt.rows[0].id]);
      await client.query(`INSERT INTO outbox_events (event_key, event_type, aggregate_type, aggregate_id, payload)
        VALUES ($1, $2, 'fulfilment', $3, $4::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      [`${provider}:${event.eventId}`, `fulfilment.${transition.status}`, fulfilment.id, JSON.stringify({ orderId: fulfilment.order_id, trackingCarrier: event.trackingCarrier, trackingReference: event.trackingReference })]);
      await this.audit(client, "fulfilment", fulfilment.id, `fulfilment.${transition.status}`, correlationId, { eventId: event.eventId });
      return "applied" as const;
    });
  }

  private async audit(client: pg.PoolClient, entityType: string, entityId: string, action: string, correlationId: string, summary: Record<string, unknown>) {
    await client.query(`INSERT INTO audit_events (entity_type, entity_id, action, actor_type, correlation_id, change_summary)
      VALUES ($1, $2, $3, 'system', $4, $5::jsonb)`, [entityType, entityId, action, correlationId, JSON.stringify(summary)]);
  }
  private async transaction<Result>(work: (client: pg.PoolClient) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
