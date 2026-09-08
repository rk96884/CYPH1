import pg from "pg";
import { FulfilmentService } from "./service.js";

type ClaimedEvent = Readonly<{ id: string; event_key: string; payload: Readonly<{ orderId?: string; correlationId?: string }> }>;

export const defaultFulfilmentAutomaticRetryLimit = 3;
export const defaultFulfilmentClaimLeaseSeconds = 300;

/** Claims verified payment events without holding a transaction across a provider call. */
export class PostgresFulfilmentOutboxConsumer {
  constructor(
    private readonly pool: pg.Pool,
    private readonly service: FulfilmentService,
    private readonly automaticRetryLimit = defaultFulfilmentAutomaticRetryLimit,
    private readonly claimLeaseSeconds = defaultFulfilmentClaimLeaseSeconds,
  ) {
    if (!Number.isSafeInteger(automaticRetryLimit) || automaticRetryLimit < 1 || automaticRetryLimit > 10) {
      throw new Error("Fulfilment automatic retry limit must be between 1 and 10.");
    }
    if (!Number.isSafeInteger(claimLeaseSeconds) || claimLeaseSeconds < 30 || claimLeaseSeconds > 3600) throw new Error("Fulfilment claim lease must be between 30 and 3600 seconds.");
  }

  async runOnce(): Promise<"processed" | "idle" | "failed"> {
    const event = await this.claim();
    if (!event) return "idle";
    if (!event.payload.orderId) { await this.finish(event.id, "failed", "missing_order_id"); return "failed"; }
    try {
      await this.service.requestForPaidOrder(event.payload.orderId, event.event_key, event.payload.correlationId);
      await this.finish(event.id, "published");
      return "processed";
    } catch (error) {
      await this.finish(event.id, "failed", error instanceof Error ? error.name : "unknown_error");
      throw error;
    }
  }

  private async claim(): Promise<ClaimedEvent | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE outbox_events SET processing_status='failed', last_error_code='retry_exhausted', processing_started_at=NULL
        WHERE aggregate_type='payment' AND event_type='payment.paid' AND processing_status='processing'
          AND attempt_count >= $1 AND processing_started_at <= now() - ($2 * interval '1 second')`, [this.automaticRetryLimit, this.claimLeaseSeconds]);
      const result = await client.query<ClaimedEvent>(`
        SELECT id, event_key, payload FROM outbox_events
         WHERE aggregate_type = 'payment' AND event_type = 'payment.paid'
           AND (processing_status = 'pending'
             OR (processing_status = 'failed' AND attempt_count < $1)
             OR (processing_status = 'processing' AND attempt_count < $1
               AND processing_started_at <= now() - ($2 * interval '1 second')))
           AND available_at <= now()
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [this.automaticRetryLimit, this.claimLeaseSeconds]);
      if (result.rowCount !== 1) { await client.query("COMMIT"); return undefined; }
      await client.query(`UPDATE outbox_events SET processing_status = 'processing',
        attempt_count = attempt_count + 1, processing_started_at=now(), last_error_code = NULL WHERE id = $1`, [result.rows[0]!.id]);
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  private async finish(id: string, status: "published" | "failed", errorCode?: string) {
    await this.pool.query(`UPDATE outbox_events SET processing_status = $2, last_error_code = $3,
      processing_started_at = NULL,
      published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
      available_at = CASE WHEN $2 = 'failed' THEN now() + interval '5 minutes' ELSE available_at END
      WHERE id = $1 AND processing_status = 'processing'`, [id, status, errorCode ?? null]);
  }
}
