import { createHash } from "node:crypto";
import pg from "pg";
import { transitionOrder, transitionPayment, type CaptureMode, type OrderStatus, type PaymentStatus } from "../../../../packages/commerce-core/src/index.js";
import { captureDeadlineState, type CaptureDeadlineConfig, type CaptureDeadlineState } from "./capture-deadline.js";
import type { CaptureMonitorClaim, CaptureMonitorObservation, CaptureMonitorRepository, CaptureMonitorSummary } from "./capture-monitor.js";

type PaymentRow = {
  id: string; order_id: string; provider: string; provider_payment_id: string | null;
  amount_minor: string; currency: string; status: PaymentStatus; capture_mode: CaptureMode | null;
  capture_before: Date | null; capture_revision: string; capture_monitor_claim_id: string | null;
};

export class PostgresCaptureMonitorRepository implements CaptureMonitorRepository {
  constructor(private readonly pool: pg.Pool) {}

  async claim(runStartedAt: Date, now: Date, claimId: string): Promise<CaptureMonitorClaim | undefined> {
    // Short atomic lease; never hold a row lock while contacting the provider.
    const result = await this.pool.query<PaymentRow>(`WITH candidate AS (
      SELECT id FROM payments WHERE status='authorised' AND capture_mode IS DISTINCT FROM 'automatic'
        AND (capture_monitor_checked_at IS NULL OR capture_monitor_checked_at < $1)
        AND (capture_monitor_claimed_at IS NULL OR capture_monitor_claimed_at <= $2::timestamptz - interval '60 seconds')
      ORDER BY capture_monitor_checked_at NULLS FIRST, capture_before NULLS FIRST, id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE payments p SET capture_monitor_claim_id=$3, capture_monitor_claimed_at=$2
      FROM candidate c WHERE p.id=c.id RETURNING p.*`, [runStartedAt, now, claimId]);
    const row = result.rows[0];
    if (!row) return undefined;
    return { id: row.id, orderId: row.order_id, provider: row.provider, providerPaymentId: row.provider_payment_id,
      amountMinor: Number(row.amount_minor), currency: row.currency, revision: row.capture_revision, claimId };
  }

  async record(claim: CaptureMonitorClaim, observation: CaptureMonitorObservation, config: CaptureDeadlineConfig, now: Date, runId: string): Promise<"recorded" | "alerted" | "conflict"> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<PaymentRow>("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [claim.id]);
      const row = result.rows[0];
      if (!row || row.capture_monitor_claim_id !== claim.claimId) { await client.query("COMMIT"); return "conflict"; }
      if (row.capture_revision !== claim.revision || row.status !== "authorised") {
        await client.query("UPDATE payments SET capture_monitor_claim_id=NULL, capture_monitor_claimed_at=NULL WHERE id=$1", [claim.id]);
        await client.query("COMMIT"); return "conflict";
      }
      let condition: CaptureDeadlineState | null = "reconciliation_required";
      let failure: string | undefined = "failure" in observation ? observation.failure : undefined;
      if ("payment" in observation) {
        const snapshot = observation.payment;
        const transition = transitionPayment(row.status, snapshot.status);
        if (transition.status !== snapshot.status || transition.outcome === "requires_review") failure = "provider_state_conflict";
        else {
          const orders = await client.query<{ status: OrderStatus }>("SELECT status FROM orders WHERE id=$1 FOR UPDATE", [row.order_id]);
          const order = orders.rows[0];
          if (!order || (snapshot.status === "captured" && !["pending_payment", "paid"].includes(order.status))) failure = "order_state_conflict";
          else {
            const mode = snapshot.captureMode ?? row.capture_mode;
            const deadline = snapshot.captureBefore ?? null;
            await client.query(`UPDATE payments SET status=$2, capture_mode=$3, capture_before=$4,
              authorised_at=COALESCE($5,authorised_at) WHERE id=$1`, [row.id, transition.status, mode, deadline, snapshot.authorisedAt ?? null]);
            row.status = transition.status; row.capture_mode = mode; row.capture_before = deadline ? new Date(deadline) : null;
            if (snapshot.status === "captured") {
              await client.query("UPDATE orders SET status=$2, paid_at=COALESCE(paid_at,now()) WHERE id=$1", [row.order_id, transitionOrder(order.status, "paid")]);
              await client.query(`INSERT INTO outbox_events (event_key,event_type,aggregate_type,aggregate_id,payload)
                VALUES ($1,'payment.paid','payment',$2,$3::jsonb) ON CONFLICT (event_key) DO NOTHING`,
              [`capture-reconciliation:${row.id}:paid`, row.id, JSON.stringify({ orderId: row.order_id, correlationId: runId })]);
            }
            if (transition.outcome === "applied") await this.audit(client, row.id, "capture_deadline.payment_reconciled", runId, { orderId: row.order_id, status: row.status });
            condition = row.status === "authorised" && mode !== "automatic" ? captureDeadlineState(mode, deadline, now, config) : null;
          }
        }
      }
      if (failure) condition = "reconciliation_required";
      let alerted = false;
      if (condition && condition !== "safe") {
        const deadline = row.capture_before?.toISOString() ?? null;
        const key = createHash("sha256").update(JSON.stringify([row.id, deadline, condition])).digest("hex");
        const payload = { paymentId: row.id, orderId: row.order_id, provider: row.provider, providerPaymentId: row.provider_payment_id,
          paymentStatus: row.status, captureBefore: deadline, condition, correlationId: runId, observedAt: now.toISOString(), ...(failure ? { failureCode: failure } : {}) };
        const event = await client.query(`INSERT INTO outbox_events (event_key,event_type,aggregate_type,aggregate_id,payload)
          VALUES ($1,$2,'payment',$3,$4::jsonb) ON CONFLICT (event_key) DO NOTHING RETURNING id`,
        [`capture-deadline:${key}`, `payment.capture_deadline.${condition}`, row.id, JSON.stringify(payload)]);
        if (event.rowCount === 1) { alerted = true; await this.audit(client, row.id, `capture_deadline.${condition}`, runId, payload); }
      }
      // Separate update: the revision trigger clears stale monitor state when payment fields change.
      await client.query(`UPDATE payments SET capture_deadline_state=$2, capture_monitor_checked_at=$3,
        capture_monitor_claim_id=NULL, capture_monitor_claimed_at=NULL WHERE id=$1`, [row.id, condition, now]);
      await client.query("COMMIT");
      return alerted ? "alerted" : "recorded";
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async summary(runStartedAt: Date, now: Date, config: CaptureDeadlineConfig): Promise<CaptureMonitorSummary> {
    const result = await this.pool.query<{ condition: CaptureDeadlineState; count: string; remaining: string }>(`SELECT condition, count(*)::text AS count,
      count(*) FILTER (WHERE capture_monitor_checked_at IS NULL OR capture_monitor_checked_at < $1)::text AS remaining FROM (
        SELECT capture_monitor_checked_at, CASE
          WHEN capture_deadline_state='reconciliation_required' OR capture_mode IS NULL THEN 'reconciliation_required'
          WHEN capture_before IS NULL THEN 'missing_deadline'
          WHEN capture_before <= $2 THEN 'overdue'
          WHEN capture_before <= $2::timestamptz + $3 * interval '1 minute' THEN 'critical'
          WHEN capture_before <= $2::timestamptz + $4 * interval '1 minute' THEN 'warning'
          ELSE 'safe' END AS condition
        FROM payments WHERE status='authorised' AND capture_mode IS DISTINCT FROM 'automatic'
      ) states GROUP BY condition`, [runStartedAt, now, config.criticalMinutes, config.warningMinutes]);
    const conditions: Partial<Record<CaptureDeadlineState, number>> = {};
    let remaining = 0;
    for (const row of result.rows) { conditions[row.condition] = Number(row.count); remaining += Number(row.remaining); }
    return { conditions, remaining };
  }

  private async audit(client: pg.PoolClient, paymentId: string, action: string, runId: string, payload: Record<string, unknown>) {
    await client.query(`INSERT INTO audit_events (entity_type,entity_id,action,actor_type,correlation_id,change_summary)
      VALUES ('payment',$1,$2,'system',$3,$4::jsonb)`, [paymentId, action, runId, JSON.stringify(payload)]);
  }
}
