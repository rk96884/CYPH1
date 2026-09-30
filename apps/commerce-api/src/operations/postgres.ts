import pg from "pg";
import { transitionOrder, transitionPayment, type CaptureInput, type NormalisedPayment, type OrderStatus, type PaymentStatus } from "../../../../packages/commerce-core/src/index.js";
import type { CaptureCommand, CaptureReservation, CaptureResult, CaptureRecovery, CaptureRecoveryReservation, CaptureReconciliationResult } from "./service.js";
import { OperationsError, type OperationsRepository, type RefundReservation, type RefundReason } from "./service.js";

const summary = (row: Record<string, any>) => Object.freeze({
  id: row.id, orderNumber: row.order_number, status: row.status, fulfilmentStatus: row.fulfilment_status,
  currency: row.currency, totalMinor: Number(row.total_minor), createdAt: row.created_at.toISOString(),
});

export class PostgresOperationsRepository implements OperationsRepository {
  constructor(private readonly pool: pg.Pool) {}

  async prepareCaptureAttempt(input: CaptureCommand & { paymentId: string; request: CaptureInput; providerContext: string | null }): Promise<void> {
    await this.transaction(async (client) => {
      const command = await client.query(`SELECT status FROM operator_commands WHERE idempotency_key=$1 AND request_fingerprint=$2
        AND status='reserved' AND capture_claim_id IS NULL AND capture_first_attempt_at IS NULL FOR UPDATE`, [input.idempotencyKey, input.fingerprint]);
      if (command.rowCount !== 1) throw new OperationsError("conflict", "Capture is already processing or requires reconciliation.");
      const payment = await client.query("SELECT status FROM payments WHERE id=$1 AND order_id=$2 FOR UPDATE", [input.paymentId, input.orderId]);
      if (payment.rows[0]?.status !== "authorised") throw new OperationsError("conflict", "Payment is no longer authorised.");
      await client.query(`UPDATE operator_commands SET capture_payment_id=$2, capture_request=$3::jsonb, capture_provider_context=$4,
        capture_first_attempt_at=clock_timestamp(), capture_claim_id=$5, capture_claimed_at=clock_timestamp() WHERE idempotency_key=$1`,
      [input.idempotencyKey, input.paymentId, JSON.stringify(input.request), input.providerContext, input.correlationId]);
      await this.audit(client, "payment", input.paymentId, "capture.attempt_reserved", input.operatorId, input.correlationId, { orderId: input.orderId });
    });
  }

  async reserveCaptureReconciliation(orderId: string, operatorId: string, claimId: string): Promise<CaptureRecoveryReservation> {
    return this.transaction(async (client) => {
      const commands = await client.query(`SELECT *,
        capture_claimed_at > clock_timestamp()-interval '2 minutes' AS active,
        created_at > clock_timestamp()-interval '2 minutes' AS recent
        FROM operator_commands WHERE command_type='payment.capture' AND target_type='order' AND target_id=$1 FOR UPDATE`, [orderId]);
      if (commands.rowCount !== 1) throw new OperationsError("not_found", "No existing capture command is available to reconcile.");
      const command = commands.rows[0];
      if (command.status === "completed") return { outcome: "replayed", result: { ...command.result, outcome: command.result.outcome ?? "capture_reconciled" } };
      if (command.active || (command.status === "reserved" && command.recent && !command.capture_first_attempt_at)) throw new OperationsError("conflict", "Capture is still processing. Reconcile after the active attempt has finished.");
      const payments = await client.query(`SELECT id,provider,provider_payment_id,amount_minor,currency,capture_revision FROM payments
        WHERE order_id=$1 AND ($2::uuid IS NULL OR id=$2) FOR UPDATE`, [orderId, command.capture_payment_id]);
      if (payments.rowCount !== 1 || !payments.rows[0].provider_payment_id) throw new OperationsError("conflict", "Capture payment cannot be identified conclusively. Manual resolution is required.");
      const payment = payments.rows[0];
      await client.query(`UPDATE operator_commands SET capture_payment_id=$2,capture_claim_id=$3,capture_claimed_at=clock_timestamp()
        WHERE idempotency_key=$1`, [command.idempotency_key, payment.id, claimId]);
      await this.audit(client, "payment", payment.id, "capture.reconciliation_reserved", operatorId, claimId, { orderId });
      return { outcome: "reserved", recovery: { orderId, paymentId: payment.id, provider: payment.provider, providerPaymentId: payment.provider_payment_id,
        amountMinor: Number(payment.amount_minor), currency: payment.currency, revision: payment.capture_revision,
        idempotencyKey: command.idempotency_key, fingerprint: command.request_fingerprint, originalOperatorId: command.operator_id,
        request: command.capture_request, firstAttemptAt: command.capture_first_attempt_at?.toISOString() ?? null,
        providerContext: command.capture_provider_context, claimId } };
    });
  }

  async permitCaptureReplay(recovery: CaptureRecovery, operatorId: string): Promise<boolean> {
    return this.transaction(async (client) => {
      const command = await client.query(`SELECT status FROM operator_commands WHERE idempotency_key=$1 AND request_fingerprint=$2
        AND capture_claim_id=$3 AND capture_claimed_at > clock_timestamp()-interval '2 minutes' FOR UPDATE`, [recovery.idempotencyKey, recovery.fingerprint, recovery.claimId]);
      if (command.rowCount !== 1 || command.rows[0].status === "completed") return false;
      const payments = await client.query("SELECT status,capture_revision,amount_minor,currency FROM payments WHERE id=$1 FOR UPDATE", [recovery.paymentId]);
      const orders = await client.query("SELECT status,total_minor,currency FROM orders WHERE id=$1 FOR UPDATE", [recovery.orderId]);
      const payment = payments.rows[0]; const order = orders.rows[0];
      if (!payment || !order || payment.capture_revision !== recovery.revision || !["authorised", "resolution_required"].includes(payment.status) ||
          order.status !== "pending_payment" || Number(payment.amount_minor) !== recovery.amountMinor || Number(order.total_minor) !== recovery.amountMinor || payment.currency !== recovery.currency || order.currency !== recovery.currency) return false;
      await this.audit(client, "payment", recovery.paymentId, "capture.original_request_replay", operatorId, recovery.claimId, { orderId: recovery.orderId });
      return true;
    });
  }

  async finishCaptureReconciliation(recovery: CaptureRecovery, operatorId: string, result: CaptureReconciliationResult, snapshot?: NormalisedPayment): Promise<CaptureReconciliationResult> {
    return this.transaction(async (client) => {
      const commands = await client.query(`SELECT status FROM operator_commands WHERE idempotency_key=$1 AND request_fingerprint=$2 AND capture_claim_id=$3 FOR UPDATE`, [recovery.idempotencyKey, recovery.fingerprint, recovery.claimId]);
      if (commands.rowCount !== 1) throw new OperationsError("conflict", "Capture reconciliation ownership changed. Reload the order.");
      const payments = await client.query("SELECT status,amount_minor,currency,provider,provider_payment_id,order_id,capture_revision FROM payments WHERE id=$1 FOR UPDATE", [recovery.paymentId]);
      const orders = await client.query("SELECT status,total_minor,currency FROM orders WHERE id=$1 FOR UPDATE", [recovery.orderId]);
      const payment = payments.rows[0]; const order = orders.rows[0];
      let persisted = result;
      if (!payment || !order || payment.order_id !== recovery.orderId || payment.provider !== recovery.provider || payment.provider_payment_id !== recovery.providerPaymentId || Number(payment.amount_minor) !== recovery.amountMinor || Number(order.total_minor) !== recovery.amountMinor || payment.currency !== recovery.currency || order.currency !== recovery.currency) throw new OperationsError("conflict", "Reconciliation financial state changed.");
      const target = result.status === "completed" ? "captured" : snapshot && ["failed", "cancelled", "expired"].includes(snapshot.status) ? snapshot.status : "resolution_required";
      const transition = transitionPayment(payment.status as PaymentStatus, target);
      if ((result.status !== "completed" && payment.capture_revision !== recovery.revision) || transition.status !== target || (target === "captured" && !["pending_payment", "paid"].includes(order.status))) {
        persisted = { ...result, status: "resolution_required", outcome: "manual_resolution_required" };
      } else {
        await client.query("UPDATE payments SET status=$2 WHERE id=$1", [recovery.paymentId, transition.status]);
        if (snapshot) await client.query(`UPDATE payments SET capture_before=$2,authorised_at=COALESCE($3,authorised_at),capture_mode=COALESCE($4,capture_mode) WHERE id=$1`,
          [recovery.paymentId, snapshot.captureBefore ?? null, snapshot.authorisedAt ?? null, snapshot.captureMode ?? null]);
        if (target === "captured") {
          await client.query("UPDATE orders SET status=$2,paid_at=COALESCE(paid_at,$3::timestamptz,now()) WHERE id=$1", [recovery.orderId, transitionOrder(order.status as OrderStatus, "paid"), snapshot?.paidAt ?? null]);
          if (transition.outcome === "applied") await client.query(`INSERT INTO outbox_events (event_key,event_type,aggregate_type,aggregate_id,payload)
            VALUES ($1,'payment.paid','payment',$2,$3::jsonb) ON CONFLICT (event_key) DO NOTHING`,
          [`capture:${recovery.paymentId}:paid`, recovery.paymentId, JSON.stringify({ orderId: recovery.orderId, correlationId: recovery.claimId })]);
        }
      }
      await client.query(`UPDATE operator_commands SET status=$2,result=$3::jsonb,capture_claim_id=NULL,capture_claimed_at=NULL WHERE idempotency_key=$1`,
        [recovery.idempotencyKey, persisted.status, JSON.stringify(persisted)]);
      await this.audit(client, "payment", recovery.paymentId, "capture.reconciled", operatorId, recovery.claimId, { orderId: recovery.orderId, status: persisted.status, outcome: persisted.outcome, providerCaptureId: persisted.providerCaptureId });
      return persisted;
    });
  }

  async reserveCapture(input: CaptureCommand): Promise<CaptureReservation> {
    return this.transaction(async (client) => {
      // Serialise even when the command row does not exist yet.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.idempotencyKey]);
      const existing = await client.query("SELECT command_type, request_fingerprint, status, result FROM operator_commands WHERE idempotency_key=$1 FOR UPDATE", [input.idempotencyKey]);
      if (existing.rowCount === 1) {
        const command = existing.rows[0];
        if (command.command_type !== "payment.capture" || command.request_fingerprint !== input.fingerprint) throw new OperationsError("conflict", "The idempotency key was used for a different request.");
        if (command.status === "reserved") throw new OperationsError("conflict", "Capture is in progress or requires manual resolution. Do not repeat capture.");
        return { outcome: "replayed", result: command.result as CaptureResult };
      }
      // Match webhook lock order: payment before order.
      const payments = await client.query("SELECT id, provider, provider_payment_id, status, amount_minor, currency FROM payments WHERE order_id=$1 ORDER BY created_at FOR UPDATE", [input.orderId]);
      const orders = await client.query("SELECT status, total_minor, currency FROM orders WHERE id=$1 FOR UPDATE", [input.orderId]);
      if (orders.rowCount !== 1) throw new OperationsError("not_found", "Order not found.");
      const order = orders.rows[0];
      const payment = payments.rows.find((row) => row.status === "authorised");
      if (order.status !== "pending_payment" || !payment || !payment.provider_payment_id || payments.rows.some((row) => ["captured", "partially_refunded", "refunded", "resolution_required"].includes(row.status)) ||
        payments.rows.filter((row) => row.status === "authorised").length !== 1 || Number(payment.amount_minor) !== Number(order.total_minor) || payment.currency !== order.currency) {
        throw new OperationsError("conflict", "An uncaptured authorised payment matching the pending order is required.");
      }
      const inserted = await client.query(`INSERT INTO operator_commands (idempotency_key, command_type, target_type, target_id, operator_id, request_fingerprint, result)
        VALUES ($1,'payment.capture','order',$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
      [input.idempotencyKey, input.orderId, input.operatorId, input.fingerprint, JSON.stringify({ paymentId: payment.id })]);
      if (inserted.rowCount !== 1) throw new OperationsError("conflict", "A capture command already exists. Manual resolution is required.");
      await this.audit(client, "payment", payment.id, "capture.reserved", input.operatorId, input.correlationId, { orderId: input.orderId });
      return { outcome: "reserved", paymentId: payment.id, provider: payment.provider, providerPaymentId: payment.provider_payment_id, amountMinor: Number(payment.amount_minor), currency: payment.currency };
    });
  }

  async finishCapture(input: CaptureCommand & { paymentId: string; result: CaptureResult }): Promise<CaptureResult> {
    return this.transaction(async (client) => {
      const commands = await client.query("SELECT status, result FROM operator_commands WHERE idempotency_key=$1 AND command_type='payment.capture' AND request_fingerprint=$2 AND (capture_claim_id IS NULL OR capture_claim_id=$3) FOR UPDATE", [input.idempotencyKey, input.fingerprint, input.correlationId]);
      if (commands.rowCount !== 1 || commands.rows[0].status !== "reserved" || commands.rows[0].result.paymentId !== input.paymentId) throw new OperationsError("conflict", "Capture reservation is not available.");
      const payments = await client.query("SELECT status FROM payments WHERE id=$1 AND order_id=$2 FOR UPDATE", [input.paymentId, input.orderId]);
      const orders = await client.query("SELECT status FROM orders WHERE id=$1 FOR UPDATE", [input.orderId]);
      const payment = payments.rows[0]; const order = orders.rows[0];
      if (!payment || !order) throw new OperationsError("conflict", "Capture payment is not available.");
      let result = input.result;
      if (result.status === "completed") {
        const transition = transitionPayment(payment.status as PaymentStatus, "captured");
        if (transition.status !== "captured" || !["pending_payment", "paid"].includes(order.status)) result = { ...result, status: "resolution_required" };
        else {
          await client.query("UPDATE payments SET status=$2 WHERE id=$1", [input.paymentId, transition.status]);
          await client.query("UPDATE orders SET status=$2, paid_at=COALESCE(paid_at,now()) WHERE id=$1", [input.orderId, transitionOrder(order.status as OrderStatus, "paid")]);
          if (transition.outcome === "applied") await client.query(`INSERT INTO outbox_events (event_key,event_type,aggregate_type,aggregate_id,payload)
            VALUES ($1,'payment.paid','payment',$2,$3::jsonb) ON CONFLICT (event_key) DO NOTHING`,
          [`capture:${input.paymentId}:paid`, input.paymentId, JSON.stringify({ orderId: input.orderId, correlationId: input.correlationId })]);
        }
      }
      if (result.status === "resolution_required") {
        const transition = transitionPayment(payment.status as PaymentStatus, "resolution_required");
        if (transition.outcome === "applied") await client.query("UPDATE payments SET status=$2 WHERE id=$1", [input.paymentId, transition.status]);
      }
      await client.query("UPDATE operator_commands SET status=$2, result=$3::jsonb, capture_claim_id=NULL,capture_claimed_at=NULL WHERE idempotency_key=$1", [input.idempotencyKey, result.status, JSON.stringify(result)]);
      await this.audit(client, "payment", input.paymentId, `capture.${result.status}`, input.operatorId, input.correlationId, { ...result, orderId: input.orderId });
      return result;
    });
  }

  async refreshCapture(input: CaptureCommand & { paymentId: string; payment: NormalisedPayment; now: Date }): Promise<boolean> {
    return this.transaction(async (client) => {
      const commands = await client.query("SELECT status, result FROM operator_commands WHERE idempotency_key=$1 AND command_type='payment.capture' AND request_fingerprint=$2 FOR UPDATE", [input.idempotencyKey, input.fingerprint]);
      if (commands.rowCount !== 1 || commands.rows[0].status !== "reserved" || commands.rows[0].result.paymentId !== input.paymentId) return false;
      const payments = await client.query("SELECT status FROM payments WHERE id=$1 AND order_id=$2 FOR UPDATE", [input.paymentId, input.orderId]);
      const orders = await client.query("SELECT status FROM orders WHERE id=$1 FOR UPDATE", [input.orderId]);
      if (payments.rows[0]?.status !== "authorised" || orders.rows[0]?.status !== "pending_payment") return false;
      await client.query(`UPDATE payments SET capture_before=$2, authorised_at=COALESCE($3,authorised_at),
        capture_mode=COALESCE($4,capture_mode) WHERE id=$1`,
      [input.paymentId, input.payment.captureBefore ?? null, input.payment.authorisedAt ?? null, input.payment.captureMode ?? null]);
      await this.audit(client, "payment", input.paymentId, "capture.provider_verified", input.operatorId, input.correlationId,
        { orderId: input.orderId, providerStatus: input.payment.status, captureBefore: input.payment.captureBefore ?? null });
      return input.payment.status === "authorised" && input.payment.captureMode !== "automatic" &&
        !!input.payment.captureBefore && Date.parse(input.payment.captureBefore) > input.now.getTime();
    });
  }

  async searchOrders(query: string, limit: number) {
    const term = query ? `%${query.replace(/[%_\\]/g, "\\$&")}%` : "%";
    const result = await this.pool.query(`SELECT id, order_number, status, fulfilment_status, currency, total_minor, created_at
      FROM orders WHERE order_number ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT $2`, [term, limit]);
    return Object.freeze(result.rows.map(summary));
  }

  async getOrder(orderId: string) {
    const order = await this.pool.query("SELECT id, order_number, status, fulfilment_status, currency, total_minor, created_at FROM orders WHERE id = $1", [orderId]);
    if (order.rowCount !== 1) return undefined;
    const [payments, refunds, fulfilments, audit, commands] = await Promise.all([
      this.pool.query("SELECT id, provider, provider_payment_id, status, amount_minor, currency, capture_mode, capture_before, authorised_at, capture_deadline_state, capture_monitor_checked_at, created_at, updated_at FROM payments WHERE order_id = $1 ORDER BY created_at", [orderId]),
      this.pool.query(`SELECT r.id, r.payment_id, r.provider_refund_id, r.status, r.amount_minor, r.currency, r.reason, r.created_at, r.updated_at
        FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.order_id = $1 ORDER BY r.created_at`, [orderId]),
      this.pool.query("SELECT id, provider, provider_reference, status, failure_code, tracking_carrier, tracking_reference, created_at, updated_at FROM fulfilments WHERE order_id = $1 ORDER BY created_at", [orderId]),
      this.pool.query(`SELECT id, entity_type, action, change_summary, created_at FROM audit_events
        WHERE (entity_type = 'order' AND entity_id = $1) OR entity_id IN
          (SELECT id FROM payments WHERE order_id = $1 UNION SELECT id FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE order_id = $1) UNION SELECT id FROM fulfilments WHERE order_id = $1)
        ORDER BY created_at`, [orderId]),
      this.pool.query("SELECT status FROM operator_commands WHERE command_type='payment.capture' AND target_type='order' AND target_id=$1", [orderId]),
    ]);
    return Object.freeze({ ...(commands.rows[0] ? { captureCommand: { status: commands.rows[0].status as string } } : {}), order: summary(order.rows[0]), payments: Object.freeze(payments.rows), refunds: Object.freeze(refunds.rows), fulfilments: Object.freeze(fulfilments.rows), timeline: Object.freeze(audit.rows.map((row) => Object.freeze({ id: row.id, type: row.entity_type, action: row.action, occurredAt: row.created_at.toISOString(), summary: row.change_summary }))) });
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
    const result = await this.pool.query(`SELECT
      o.order_number, o.created_at AS order_created_at, o.status AS order_status,
      o.fulfilment_status, o.currency, o.total_minor,
      cs.state AS checkout_state, cs.failure_code AS checkout_failure_code,
      p.provider, p.provider_payment_id, p.created_at AS payment_created_at,
      p.status AS payment_status, p.amount_minor,
      COALESCE(ra.refunded_minor, 0) AS refunded_minor,
      COALESCE(ra.open_refund_minor, 0) AS open_refund_minor,
      COALESCE(ra.resolution_required_refund_minor, 0) AS resolution_required_refund_minor,
      COALESCE(ra.failed_refund_minor, 0) AS failed_refund_minor,
      COALESCE(ra.refund_count, 0) AS refund_count,
      f.provider_reference AS fulfilment_reference, f.status AS fulfilment_record_status
      FROM orders o
      LEFT JOIN checkout_sessions cs ON cs.order_id = o.id
      LEFT JOIN payments p ON p.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(sum(r.amount_minor) FILTER (WHERE r.status = 'completed'), 0) AS refunded_minor,
          COALESCE(sum(r.amount_minor) FILTER (WHERE r.status IN ('created', 'pending')), 0) AS open_refund_minor,
          COALESCE(sum(r.amount_minor) FILTER (WHERE r.status = 'resolution_required'), 0) AS resolution_required_refund_minor,
          COALESCE(sum(r.amount_minor) FILTER (WHERE r.status IN ('failed', 'cancelled')), 0) AS failed_refund_minor,
          count(r.id) AS refund_count,
          bool_or(r.created_at >= $1::timestamptz AND r.created_at < $2::timestamptz) AS has_activity
        FROM refunds r WHERE r.payment_id = p.id
      ) ra ON true
      LEFT JOIN LATERAL (
        SELECT * FROM fulfilments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) f ON true
      WHERE (o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz)
         OR (p.created_at >= $1::timestamptz AND p.created_at < $2::timestamptz)
         OR COALESCE(ra.has_activity, false)
      ORDER BY o.created_at, p.created_at NULLS FIRST LIMIT $3`, [from, to, limit]);
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
