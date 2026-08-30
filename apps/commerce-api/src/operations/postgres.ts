import pg from "pg";
import { OperationsError, type OperationsRepository, type RefundReservation, type RefundReason } from "./service.js";

const summary = (row: Record<string, any>) => Object.freeze({
  id: row.id, orderNumber: row.order_number, status: row.status, fulfilmentStatus: row.fulfilment_status,
  currency: row.currency, totalMinor: Number(row.total_minor), createdAt: row.created_at.toISOString(),
});

export class PostgresOperationsRepository implements OperationsRepository {
  constructor(private readonly pool: pg.Pool) {}

  async searchOrders(query: string, limit: number) {
    const term = query ? `%${query.replace(/[%_\\]/g, "\\$&")}%` : "%";
    const result = await this.pool.query(`SELECT id, order_number, status, fulfilment_status, currency, total_minor, created_at
      FROM orders WHERE order_number ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT $2`, [term, limit]);
    return Object.freeze(result.rows.map(summary));
  }

  async getOrder(orderId: string) {
    const order = await this.pool.query("SELECT id, order_number, status, fulfilment_status, currency, total_minor, created_at FROM orders WHERE id = $1", [orderId]);
    if (order.rowCount !== 1) return undefined;
    const [payments, refunds, fulfilments, audit] = await Promise.all([
      this.pool.query("SELECT id, provider, provider_payment_id, status, amount_minor, currency, created_at, updated_at FROM payments WHERE order_id = $1 ORDER BY created_at", [orderId]),
      this.pool.query(`SELECT r.id, r.payment_id, r.provider_refund_id, r.status, r.amount_minor, r.currency, r.reason, r.created_at, r.updated_at
        FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.order_id = $1 ORDER BY r.created_at`, [orderId]),
      this.pool.query("SELECT id, provider, provider_reference, status, failure_code, tracking_carrier, tracking_reference, created_at, updated_at FROM fulfilments WHERE order_id = $1 ORDER BY created_at", [orderId]),
      this.pool.query(`SELECT id, entity_type, action, change_summary, created_at FROM audit_events
        WHERE (entity_type = 'order' AND entity_id = $1) OR entity_id IN
          (SELECT id FROM payments WHERE order_id = $1 UNION SELECT id FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE order_id = $1) UNION SELECT id FROM fulfilments WHERE order_id = $1)
        ORDER BY created_at`, [orderId]),
    ]);
    return Object.freeze({ order: summary(order.rows[0]), payments: Object.freeze(payments.rows), refunds: Object.freeze(refunds.rows), fulfilments: Object.freeze(fulfilments.rows), timeline: Object.freeze(audit.rows.map((row) => Object.freeze({ id: row.id, type: row.entity_type, action: row.action, occurredAt: row.created_at.toISOString(), summary: row.change_summary }))) });
  }

  async reserveRefund(input: Readonly<{ orderId: string; amountMinor: number; reason: RefundReason; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>): Promise<RefundReservation> {
    return this.transaction(async (client) => {
      const command = await client.query("SELECT request_fingerprint, status, result FROM operator_commands WHERE idempotency_key = $1 FOR UPDATE", [input.idempotencyKey]);
      if (command.rowCount === 1) {
        if (command.rows[0].request_fingerprint !== input.fingerprint) throw new OperationsError("conflict", "The idempotency key was used for a different request.");
        if (command.rows[0].status === "completed") return Object.freeze({ outcome: "replayed" as const, refundId: "", paymentId: "", provider: "", providerPaymentId: "", currency: "GBP", amountMinor: 0, refundableMinor: 0, result: command.rows[0].result });
        throw new OperationsError("conflict", "The refund request is already being processed or previously failed.");
      }
      const payment = await client.query(`SELECT p.id, p.provider, p.provider_payment_id, p.amount_minor, p.currency,
        COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.payment_id = p.id AND r.status IN ('created','pending','completed','resolution_required')), 0) AS reserved_minor
        FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.order_id = $1 AND p.status IN ('captured','partially_refunded') ORDER BY p.created_at DESC LIMIT 1 FOR UPDATE OF p`, [input.orderId]);
      if (payment.rowCount !== 1 || !payment.rows[0].provider_payment_id) throw new OperationsError("conflict", "No captured provider payment is available for refund.");
      const row = payment.rows[0]; const refundableMinor = Number(row.amount_minor) - Number(row.reserved_minor);
      if (input.amountMinor > refundableMinor) throw new OperationsError("conflict", "Refund amount exceeds the unreserved payment balance.");
      const refund = await client.query(`INSERT INTO refunds (payment_id, amount_minor, currency, reason, status, idempotency_key)
        VALUES ($1,$2,$3,$4,'created',$5) RETURNING id`, [row.id, input.amountMinor, row.currency, input.reason, input.idempotencyKey]);
      await client.query(`INSERT INTO operator_commands (idempotency_key, command_type, target_type, target_id, operator_id, request_fingerprint)
        VALUES ($1,'refund.create','order',$2,$3,$4)`, [input.idempotencyKey, input.orderId, input.operatorId, input.fingerprint]);
      await this.audit(client, "refund", refund.rows[0].id, "refund.reserved", input.operatorId, input.correlationId, { orderId: input.orderId, amountMinor: input.amountMinor, reason: input.reason });
      return Object.freeze({ outcome: "reserved" as const, refundId: refund.rows[0].id, paymentId: row.id, provider: row.provider, providerPaymentId: row.provider_payment_id, currency: row.currency, amountMinor: input.amountMinor, refundableMinor });
    });
  }

  async completeRefund(input: Readonly<{ refundId: string; providerRefundId: string; status: "pending" | "completed" | "failed"; operatorId: string; correlationId: string }>) {
    await this.transaction(async (client) => {
      const status = input.status === "failed" ? "failed" : input.status;
      const refund = await client.query(`UPDATE refunds SET provider_refund_id=$2, status=$3 WHERE id=$1 RETURNING payment_id, amount_minor, currency, idempotency_key,
        (SELECT order_id FROM payments WHERE id=refunds.payment_id) order_id`, [input.refundId, input.providerRefundId, status]);
      if (refund.rowCount !== 1) throw new OperationsError("not_found", "Refund reservation was not found.");
      if (status === "completed") await this.updateRefundedState(client, refund.rows[0].payment_id);
      const result = { providerRefundId: input.providerRefundId, status, amount: { value: Number(refund.rows[0].amount_minor), currency: refund.rows[0].currency } };
      await client.query("UPDATE operator_commands SET status='completed', result=$2::jsonb WHERE idempotency_key=$1", [refund.rows[0].idempotency_key, JSON.stringify(result)]);
      await this.audit(client, "refund", input.refundId, `refund.${status}`, input.operatorId, input.correlationId, result);
      if (status === "completed") await client.query(`INSERT INTO outbox_events (event_key,event_type,aggregate_type,aggregate_id,payload)
        VALUES ($1,'refund.completed','refund',$2,$3::jsonb) ON CONFLICT (event_key) DO NOTHING`, [`refund:${input.refundId}:completed`, input.refundId, JSON.stringify({ orderId: refund.rows[0].order_id, refundId: input.refundId, amountMinor: Number(refund.rows[0].amount_minor), currency: refund.rows[0].currency, correlationId: input.correlationId })]);
    });
  }

  async failRefund(input: Readonly<{ refundId: string; failureCode: string; operatorId: string; correlationId: string }>) {
    await this.transaction(async (client) => {
      const refund = await client.query("UPDATE refunds SET status='failed' WHERE id=$1 AND status='created' RETURNING idempotency_key", [input.refundId]);
      if (refund.rowCount === 1) await client.query("UPDATE operator_commands SET status='failed', failure_code=$2 WHERE idempotency_key=$1", [refund.rows[0].idempotency_key, input.failureCode]);
      await this.audit(client, "refund", input.refundId, "refund.failed", input.operatorId, input.correlationId, { failureCode: input.failureCode });
    });
  }

  async markRefundResolutionRequired(input: Readonly<{ refundId: string; operatorId: string; correlationId: string }>) {
    await this.transaction(async (client) => {
      const refund = await client.query("UPDATE refunds SET status='resolution_required' WHERE id=$1 AND status='created' RETURNING idempotency_key", [input.refundId]);
      if (refund.rowCount !== 1) throw new OperationsError("conflict", "Refund was not available for resolution marking.");
      await client.query("UPDATE operator_commands SET status='failed', failure_code='ambiguous_provider_outcome' WHERE idempotency_key=$1", [refund.rows[0].idempotency_key]);
      await this.audit(client, "refund", input.refundId, "refund.resolution_required", input.operatorId, input.correlationId, { failureCode: "ambiguous_provider_outcome" });
    });
  }

  async retryOutbox(input: Readonly<{ eventId: string; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>) {
    return this.transaction(async (client) => {
      const command = await client.query("SELECT request_fingerprint, status, result FROM operator_commands WHERE idempotency_key=$1 FOR UPDATE", [input.idempotencyKey]);
      if (command.rowCount === 1) {
        if (command.rows[0].request_fingerprint !== input.fingerprint) throw new OperationsError("conflict", "The idempotency key was used for a different request.");
        return Object.freeze({ replayed: true, eventId: input.eventId });
      }
      const event = await client.query(`UPDATE outbox_events SET processing_status='pending', available_at=now(), last_error_code=NULL
        WHERE id=$1 AND processing_status='failed' AND event_type='payment.paid' RETURNING id, aggregate_id`, [input.eventId]);
      if (event.rowCount !== 1) throw new OperationsError("conflict", "Only failed paid-payment fulfilment events can be retried.");
      await client.query(`INSERT INTO operator_commands (idempotency_key, command_type, target_type, target_id, operator_id, request_fingerprint, status, result)
        VALUES ($1,'outbox.retry','outbox_event',$2,$3,$4,'completed',$5::jsonb)`, [input.idempotencyKey, input.eventId, input.operatorId, input.fingerprint, JSON.stringify({ eventId: input.eventId })]);
      await this.audit(client, "outbox_event", input.eventId, "outbox.retry_requested", input.operatorId, input.correlationId, {});
      return Object.freeze({ replayed: false, eventId: input.eventId });
    });
  }

  async reconciliationRows(from: string, to: string, limit: number) {
    const result = await this.pool.query(`SELECT o.order_number, o.created_at, o.status AS order_status, o.fulfilment_status, o.currency, o.total_minor,
      p.provider, p.provider_payment_id, p.status AS payment_status, p.amount_minor,
      COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.payment_id=p.id AND r.status='completed'),0) AS refunded_minor,
      f.provider_reference AS fulfilment_reference, f.status AS fulfilment_record_status
      FROM orders o LEFT JOIN LATERAL (SELECT * FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) p ON true
      LEFT JOIN LATERAL (SELECT * FROM fulfilments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) f ON true
      WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz ORDER BY o.created_at LIMIT $3`, [from, to, limit]);
    return Object.freeze(result.rows);
  }

  private async updateRefundedState(client: pg.PoolClient, paymentId: string) {
    const totals = await client.query(`SELECT p.order_id,p.amount_minor,COALESCE(sum(r.amount_minor) FILTER (WHERE r.status='completed'),0) refunded
      FROM payments p LEFT JOIN refunds r ON r.payment_id=p.id WHERE p.id=$1 GROUP BY p.id`, [paymentId]);
    const row=totals.rows[0], full=Number(row.refunded)>=Number(row.amount_minor);
    await client.query("UPDATE payments SET status=$2 WHERE id=$1", [paymentId, full ? "refunded" : "partially_refunded"]);
    await client.query("UPDATE orders SET status=$2 WHERE id=$1", [row.order_id, full ? "refunded" : "partially_refunded"]);
  }
  private audit(client: pg.PoolClient, entityType: string, entityId: string, action: string, actorId: string, correlationId: string, summary: Record<string, unknown>) {
    return client.query(`INSERT INTO audit_events (entity_type,entity_id,action,actor_type,actor_id,correlation_id,change_summary)
      VALUES ($1,$2,$3,'operator',$4,$5,$6::jsonb)`, [entityType, entityId, action, actorId, correlationId, JSON.stringify(summary)]).then(() => undefined);
  }
  private async transaction<Result>(work:(client:pg.PoolClient)=>Promise<Result>):Promise<Result>{const client=await this.pool.connect();try{await client.query("BEGIN");const result=await work(client);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
}
