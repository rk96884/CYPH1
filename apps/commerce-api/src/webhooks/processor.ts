import { createHash, randomUUID } from "node:crypto";
import {
  transitionOrder, transitionPayment, type OrderStatus, type PaymentEvent,
  type PaymentProvider, type PaymentStatus, type VerifyWebhookInput,
} from "../../../../packages/commerce-core/src/index.js";

type QueryResult<Row> = Readonly<{ rowCount: number | null; rows: Row[] }>;
export interface TransactionClient {
  query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
}
export interface TransactionRunner {
  transaction<Result>(work: (client: TransactionClient) => Promise<Result>): Promise<Result>;
}

type PaymentRow = {
  id: string; order_id: string; status: PaymentStatus; amount_minor: string;
  currency: string;
};
type OrderRow = { id: string; status: OrderStatus };

export type WebhookProcessingResult = Readonly<{
  acknowledgement: "processed" | "duplicate" | "ignored" | "rejected";
  eventCount: number;
}>;

const eventPaymentStatus = (event: PaymentEvent): PaymentStatus | undefined => ({
  "payment.pending": "pending", "payment.authorised": "authorised",
  "payment.paid": "captured", "payment.failed": "failed",
  "payment.cancelled": "cancelled", "payment.expired": "expired",
  "refund.pending": undefined, "refund.completed": undefined,
  "refund.failed": undefined, "dispute.opened": "dispute_opened",
  "dispute.updated": "dispute_resolved",
})[event.type] as PaymentStatus | undefined;

const orderStatusFor = (paymentStatus: PaymentStatus): OrderStatus | undefined => {
  if (paymentStatus === "captured") return "paid";
  if (paymentStatus === "partially_refunded") return "partially_refunded";
  if (paymentStatus === "refunded") return "refunded";
  return undefined;
};

export class PaymentWebhookProcessor {
  constructor(
    private readonly provider: PaymentProvider,
    private readonly database: TransactionRunner,
  ) {}

  async process(input: VerifyWebhookInput, correlationId = randomUUID()): Promise<WebhookProcessingResult> {
    const bodyHash = createHash("sha256").update(input.rawBody).digest("hex");
    const deliveryId = await this.database.transaction(async (client) => {
      const delivery = await client.query<{ id: string }>(`
        INSERT INTO webhook_deliveries (provider, raw_body, raw_body_sha256, correlation_id)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [this.provider.key, Buffer.from(input.rawBody), bodyHash, correlationId]);
      return delivery.rows[0]!.id;
    });
    let verified;
    try { verified = await this.provider.verifyWebhook(input); }
    catch (error) {
      await this.#markDelivery(deliveryId, "verification_error");
      throw error;
    }
    await this.#markDelivery(deliveryId, verified.outcome);
    if (verified.outcome === "invalid" || verified.outcome === "malformed") {
      return Object.freeze({ acknowledgement: "rejected", eventCount: 0 });
    }
    if (verified.outcome === "irrelevant") {
      await this.#recordIgnored(verified.providerEventId ?? bodyHash, correlationId);
      return Object.freeze({ acknowledgement: "ignored", eventCount: 0 });
    }
    const events = await this.provider.normaliseWebhook(verified);
    if (events.length === 0) {
      await this.#recordIgnored(verified.providerEventId ?? bodyHash, correlationId);
      return Object.freeze({ acknowledgement: "ignored", eventCount: 0 });
    }

    return this.database.transaction(async (client) => {
      let applied = 0;
      let ignored = 0;
      for (const event of events) {
        const receipt = await client.query<{ id: string; processing_status: string }>(`
          INSERT INTO webhook_events
            (provider, provider_event_id, event_type, signature_valid, processing_status,
             correlation_id, attempt_count)
          VALUES ($1, $2, $3, true, 'received', $4, 1)
          ON CONFLICT (provider, provider_event_id) WHERE provider_event_id IS NOT NULL
          DO UPDATE SET attempt_count = webhook_events.attempt_count + 1
          RETURNING id, processing_status
        `, [event.provider, event.eventId, event.type, correlationId]);
        if (receipt.rows[0]?.processing_status === "processed" || receipt.rows[0]?.processing_status === "ignored") continue;

        const targetStatus = eventPaymentStatus(event);
        if (!targetStatus || !event.providerPaymentId) {
          await client.query("UPDATE webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = $1", [receipt.rows[0]!.id]);
          ignored += 1;
          continue;
        }
        const paymentResult = await client.query<PaymentRow>(`
          SELECT id, order_id, status, amount_minor, currency FROM payments
          WHERE provider = $1 AND provider_payment_id = $2 FOR UPDATE
        `, [event.provider, event.providerPaymentId]);
        const payment = paymentResult.rows[0];
        if (!payment) throw new Error("payment_reference_not_found");
        if (event.amount && (event.amount.currency !== payment.currency || event.amount.value !== Number(payment.amount_minor))) {
          throw new Error("payment_amount_mismatch");
        }
        const paymentTransition = transitionPayment(payment.status, targetStatus);
        if (paymentTransition.outcome === "requires_review") throw new Error("payment_transition_requires_review");
        if (paymentTransition.outcome === "applied") {
          await client.query("UPDATE payments SET status = $1 WHERE id = $2", [paymentTransition.status, payment.id]);
        }

        const orderResult = await client.query<OrderRow>("SELECT id, status FROM orders WHERE id = $1 FOR UPDATE", [payment.order_id]);
        const order = orderResult.rows[0];
        if (!order) throw new Error("order_not_found");
        const desiredOrderStatus = orderStatusFor(paymentTransition.status);
        if (desiredOrderStatus) {
          const nextOrderStatus = transitionOrder(order.status, desiredOrderStatus);
          if (nextOrderStatus !== order.status) {
            await client.query("UPDATE orders SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END, cancelled_at = CASE WHEN $1 = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END WHERE id = $2", [nextOrderStatus, order.id]);
          }
        }
        if (paymentTransition.outcome === "applied") {
          await client.query(`
            INSERT INTO outbox_events (event_key, event_type, aggregate_type, aggregate_id, payload)
            VALUES ($1, $2, 'payment', $3, $4::jsonb) ON CONFLICT (event_key) DO NOTHING
          `, [`${event.provider}:${event.eventId}`, event.type, payment.id, JSON.stringify({ orderId: payment.order_id, correlationId })]);
          applied += 1;
        }
        await client.query("UPDATE webhook_events SET processing_status = $1, processed_at = now(), last_error_code = NULL WHERE id = $2", [paymentTransition.outcome === "ignored" ? "ignored" : "processed", receipt.rows[0]!.id]);
        if (paymentTransition.outcome === "ignored") ignored += 1;
      }
      return Object.freeze({ acknowledgement: applied > 0 ? "processed" : ignored > 0 ? "ignored" : "duplicate", eventCount: applied });
    });
  }

  async #markDelivery(deliveryId: string, outcome: "actionable" | "irrelevant" | "invalid" | "malformed" | "verification_error") {
    await this.database.transaction(async (client) => {
      await client.query("UPDATE webhook_deliveries SET verification_outcome = $1, verified_at = now() WHERE id = $2", [outcome, deliveryId]);
    });
  }

  async #recordIgnored(eventId: string, correlationId: string) {
    await this.database.transaction(async (client) => {
      await client.query(`INSERT INTO webhook_events
        (provider, provider_event_id, event_type, signature_valid, processing_status, correlation_id, attempt_count, processed_at)
        VALUES ($1, $2, 'irrelevant', true, 'ignored', $3, 1, now())
        ON CONFLICT (provider, provider_event_id) WHERE provider_event_id IS NOT NULL
        DO UPDATE SET attempt_count = webhook_events.attempt_count + 1`,
      [this.provider.key, eventId, correlationId]);
    });
  }
}
