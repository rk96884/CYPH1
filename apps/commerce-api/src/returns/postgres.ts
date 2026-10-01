import pg from "pg";
import { ReturnDomainError, assertReturnClosure, transitionReturn, type ReturnStatus, type ReturnCategory, type ReturnInspectionOutcome } from "../../../../packages/commerce-core/src/index.js";
import type { ReturnCommand, ReturnRecord, ReturnRepository } from "./service.js";

type Row = {
  id: string; return_reference: string; order_id: string; status: ReturnStatus; request_category: ReturnCategory;
  currency: string; approved_refund_minor: string | null; receipt_required: boolean; receipt_waiver_reason: string | null;
  inspection_outcome: ReturnInspectionOutcome | null; decision_reason: string | null; closure_reason: string | null;
  requested_at: Date; approved_at: Date | null; received_at: Date | null; inspected_at: Date | null; closed_at: Date | null;
  created_at: Date; updated_at: Date; version: number;
};
type ItemRow = { return_id: string; order_item_id: string; requested_quantity: number; approved_quantity: number | null; received_quantity: number };
const record = (row: Row, items: readonly ItemRow[]): ReturnRecord => ({
  id: row.id, reference: row.return_reference, orderId: row.order_id, status: row.status, category: row.request_category,
  currency: row.currency, approvedRefundMinor: row.approved_refund_minor === null ? null : Number(row.approved_refund_minor),
  receiptRequired: row.receipt_required, receiptWaiverReason: row.receipt_waiver_reason, inspectionOutcome: row.inspection_outcome,
  decisionReason: row.decision_reason, closureReason: row.closure_reason, requestedAt: row.requested_at.toISOString(),
  approvedAt: row.approved_at?.toISOString() ?? null, receivedAt: row.received_at?.toISOString() ?? null,
  inspectedAt: row.inspected_at?.toISOString() ?? null, closedAt: row.closed_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), version: row.version,
  items: items.filter((item) => item.return_id === row.id).map((item) => ({ orderItemId: item.order_item_id, requestedQuantity: item.requested_quantity, approvedQuantity: item.approved_quantity, receivedQuantity: item.received_quantity })),
});

export class PostgresReturnRepository implements ReturnRepository {
  constructor(private readonly pool: pg.Pool) {}
  async list(orderId: string): Promise<readonly ReturnRecord[]> {
    // One statement gives parent rows and quantities the same MVCC snapshot.
    const rows = await this.pool.query<Row & { items: ItemRow[] }>(`SELECT r.*,
      COALESCE((SELECT jsonb_agg(to_jsonb(ri) ORDER BY ri.order_item_id)
        FROM return_items ri WHERE ri.return_id=r.id), '[]'::jsonb) AS items
      FROM returns r WHERE r.order_id=$1 ORDER BY r.created_at,r.id`, [orderId]);
    return rows.rows.map((row) => record(row, row.items));
  }
  async execute(command: ReturnCommand): Promise<ReturnRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize identical command keys before checking their durable result.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [command.idempotencyKey]);
      const existing = await client.query<{ request_fingerprint: string; result: ReturnRecord }>("SELECT request_fingerprint,result FROM operator_commands WHERE idempotency_key=$1", [command.idempotencyKey]);
      if (existing.rowCount === 1) {
        if (existing.rows[0]!.request_fingerprint !== command.fingerprint) throw new ReturnDomainError("conflict", "The idempotency key was used for a different request.");
        await client.query("COMMIT"); return existing.rows[0]!.result;
      }
      // Refund completion locks refund -> payment -> order. Never wait for its
      // refund lock while holding an order lock: refuse busy closure immediately.
      // SHARE also fences new refund reservations until this transaction commits.
      if (command.action === "close") await client.query("LOCK TABLE refunds IN SHARE MODE NOWAIT");
      // Return mutations then lock the order. The subsequent allocation query
      // has a fresh READ COMMITTED snapshot after concurrent mutations finish.
      const order = await client.query<{ currency: string }>(`SELECT currency FROM orders WHERE id=$1 FOR UPDATE${command.action === "close" ? " NOWAIT" : ""}`, [command.orderId]);
      if (order.rowCount !== 1) throw new ReturnDomainError("not_found", "The order was not found.");
      let id: string;
      let audit: Record<string, unknown> = { orderId: command.orderId };
      if (command.action === "request") {
        const selected = await client.query<{ id: string; quantity: number }>("SELECT id,quantity FROM order_items WHERE order_id=$1 AND id=ANY($2::uuid[]) ORDER BY id", [command.orderId, command.items.map((item) => item.orderItemId)]);
        if (selected.rowCount !== command.items.length) throw new ReturnDomainError("invalid_request", "Return items must belong to the selected order.");
        const allocated = await client.query<{ order_item_id: string; quantity: string }>(`SELECT ri.order_item_id,sum(CASE WHEN r.status='requested' THEN ri.requested_quantity ELSE COALESCE(ri.approved_quantity,ri.requested_quantity) END) AS quantity
          FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE r.order_id=$1 AND r.status NOT IN ('rejected','cancelled') GROUP BY ri.order_item_id`, [command.orderId]);
        for (const item of command.items) {
          const purchased = selected.rows.find((row) => row.id === item.orderItemId)!.quantity;
          const reserved = Number(allocated.rows.find((row) => row.order_item_id === item.orderItemId)?.quantity ?? 0);
          if (reserved + item.quantity > purchased) throw new ReturnDomainError("conflict", "Return quantities exceed the available purchased units.");
        }
        const inserted = await client.query<{ id: string }>("INSERT INTO returns(order_id,request_category,currency) VALUES($1,$2,$3) RETURNING id", [command.orderId, command.category, order.rows[0]!.currency]);
        id = inserted.rows[0]!.id;
        for (const item of command.items) await client.query("INSERT INTO return_items(return_id,order_id,order_item_id,requested_quantity) VALUES($1,$2,$3,$4)", [id, command.orderId, item.orderItemId, item.quantity]);
        audit = { ...audit, category: command.category, items: command.items };
      } else {
        id = command.returnId;
        const selected = await client.query<Row>("SELECT * FROM returns WHERE id=$1 AND order_id=$2 FOR UPDATE", [id, command.orderId]);
        if (selected.rowCount !== 1) throw new ReturnDomainError("not_found", "The return was not found for this order.");
        const row = selected.rows[0]!;
        if (row.version !== command.expectedVersion) throw new ReturnDomainError("conflict", "The return changed. Reload it before acting.");
        const status = transitionReturn(row.status, command.action, !row.receipt_required);
        const items = await client.query<ItemRow>("SELECT return_id,order_item_id,requested_quantity,approved_quantity,received_quantity FROM return_items WHERE return_id=$1 ORDER BY order_item_id", [id]);
        switch (command.action) {
          case "approve": {
            this.checkItems(items.rows, command.items);
            for (const item of command.items) {
              if (item.quantity > items.rows.find((existing) => existing.order_item_id === item.orderItemId)!.requested_quantity) throw new ReturnDomainError("conflict", "Approved quantities exceed the request.");
              await client.query("UPDATE return_items SET approved_quantity=$3 WHERE return_id=$1 AND order_item_id=$2", [id, item.orderItemId, item.quantity]);
            }
            await client.query("UPDATE returns SET approved_refund_minor=$2,receipt_required=$3,receipt_waiver_reason=$4,approved_at=now(),decision_reason='operator_approved' WHERE id=$1", [id, command.approvedRefundMinor, command.receiptRequired, command.receiptWaiverReason]);
            audit = { ...audit, approvedRefundMinor: command.approvedRefundMinor, currency: row.currency, receiptRequired: command.receiptRequired, receiptWaiverReason: command.receiptWaiverReason, items: command.items }; break;
          }
          case "reject": case "cancel":
            await client.query("UPDATE returns SET decision_reason=$2 WHERE id=$1", [id, command.reason]); audit = { ...audit, reason: command.reason }; break;
          case "receive": {
            if (row.inspected_at) throw new ReturnDomainError("conflict", "Receipt quantities cannot change after inspection.");
            this.checkItems(items.rows, command.items);
            for (const item of command.items) {
              const previous = items.rows.find((existing) => existing.order_item_id === item.orderItemId)!;
              if (item.quantity < previous.received_quantity || item.quantity > (previous.approved_quantity ?? 0)) throw new ReturnDomainError("conflict", "Received quantities must be cumulative and within approval.");
              await client.query("UPDATE return_items SET received_quantity=$3 WHERE return_id=$1 AND order_item_id=$2", [id, item.orderItemId, item.quantity]);
            }
            await client.query("UPDATE returns SET received_at=COALESCE(received_at,now()) WHERE id=$1", [id]); audit = { ...audit, items: command.items }; break;
          }
          case "inspect":
            if (row.inspected_at) throw new ReturnDomainError("conflict", "The inspection decision is already recorded.");
            if (items.rows.some((item) => item.received_quantity !== item.approved_quantity)) throw new ReturnDomainError("conflict", "All approved items must be received before final inspection.");
            await client.query("UPDATE returns SET inspection_outcome=$2,inspected_at=now() WHERE id=$1", [id, command.outcome]); audit = { ...audit, outcome: command.outcome }; break;
          case "close": {
            if (row.receipt_required && items.rows.some((item) => item.received_quantity !== item.approved_quantity)) throw new ReturnDomainError("conflict", "All approved items must be received before closure.");
            const unresolved = await client.query("SELECT 1 FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1 AND r.status IN ('created','pending','resolution_required') LIMIT 1", [command.orderId]);
            if (unresolved.rowCount) throw new ReturnDomainError("conflict", "An order refund requires resolution before this return can close.");
            const refunds = await client.query<{ status: string; amount_minor: string; currency: string; order_id: string }>("SELECT r.status,r.amount_minor,r.currency,p.order_id FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.return_id=$1", [id]);
            if (refunds.rows.some((refund) => refund.order_id !== command.orderId)) throw new ReturnDomainError("conflict", "The linked refund relationship requires resolution before closure.");
            const reason = assertReturnClosure({ approvedRefundMinor: row.approved_refund_minor === null ? null : Number(row.approved_refund_minor), inspected: !!row.inspected_at, receiptWaived: !row.receipt_required, currency: row.currency, refunds: refunds.rows.map((refund) => ({ status: refund.status, amountMinor: Number(refund.amount_minor), currency: refund.currency })) });
            await client.query("UPDATE returns SET closed_at=now(),closure_reason=$2 WHERE id=$1", [id, reason]); audit = { ...audit, reason }; break;
          }
        }
        await client.query("UPDATE returns SET status=$2,version=version+1 WHERE id=$1 AND version=$3", [id, status, command.expectedVersion]);
      }
      const finalRow = await client.query<Row>("SELECT * FROM returns WHERE id=$1", [id]);
      const finalItems = await client.query<ItemRow>("SELECT return_id,order_item_id,requested_quantity,approved_quantity,received_quantity FROM return_items WHERE return_id=$1 ORDER BY order_item_id", [id]);
      const result = record(finalRow.rows[0]!, finalItems.rows);
      const event = { request: "requested", approve: "approved", reject: "rejected", cancel: "cancelled", receive: "received", inspect: "inspected", close: "closed" }[command.action];
      await client.query(`INSERT INTO operator_commands(idempotency_key,command_type,target_type,target_id,operator_id,request_fingerprint,status,result)
        VALUES($1,$2,'return',$3,$4,$5,'completed',$6::jsonb)`, [command.idempotencyKey, `return.${command.action}`, id, command.operatorId, command.fingerprint, JSON.stringify(result)]);
      await client.query(`INSERT INTO audit_events(entity_type,entity_id,action,actor_type,actor_id,correlation_id,change_summary)
        VALUES('return',$1,$2,'operator',$3,$4,$5::jsonb)`, [id, `return.${event}`, command.operatorId, command.correlationId, JSON.stringify({ ...audit, version: result.version })]);
      await client.query("COMMIT"); return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ReturnDomainError) throw error;
      if (error instanceof Error && "code" in error && ["23505", "40001", "40P01", "55P03"].includes(String(error.code))) throw new ReturnDomainError("conflict", "The return command conflicts with another action.");
      throw error;
    } finally { client.release(); }
  }
  private checkItems(existing: readonly ItemRow[], input: readonly Readonly<{ orderItemId: string }>[]) {
    if (input.length !== existing.length || input.some((item) => !existing.some((row) => row.order_item_id === item.orderItemId))) throw new ReturnDomainError("invalid_request", "Supply quantities for each item on the return.");
  }
}
