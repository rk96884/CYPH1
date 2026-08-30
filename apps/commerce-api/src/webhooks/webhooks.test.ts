import assert from "node:assert/strict";
import test from "node:test";
import { money, type PaymentEvent, type PaymentProvider, type VerifiedWebhook } from "../../../../packages/commerce-core/src/index.js";
import { PaymentWebhookProcessor, type TransactionClient, type TransactionRunner } from "./processor.js";

type Receipt = { id: string; processing_status: string; attempts: number };

class MemoryDatabase implements TransactionRunner, TransactionClient {
  payment = { id: "11111111-1111-4111-8111-111111111111", order_id: "22222222-2222-4222-8222-222222222222", status: "pending", amount_minor: "12000", currency: "GBP" };
  order = { id: this.payment.order_id, status: "pending_payment" };
  receipts = new Map<string, Receipt>();
  outbox = new Set<string>();
  rawBodies: Buffer[] = [];
  deliveries = new Map<string, string>();

  async transaction<Result>(work: (client: TransactionClient) => Promise<Result>) { return work(this); }
  async query<Row>(text: string, values: readonly unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();
    let rows: unknown[] = [];
    if (sql.startsWith("INSERT INTO webhook_deliveries")) {
      const id = `delivery-${this.deliveries.size + 1}`;
      this.rawBodies.push(values[1] as Buffer); this.deliveries.set(id, "pending"); rows = [{ id }];
    } else if (sql.startsWith("UPDATE webhook_deliveries")) this.deliveries.set(String(values[1]), String(values[0]));
    else if (sql.startsWith("INSERT INTO webhook_events") && sql.includes("provider_event_id")) {
      const key = String(values[1]);
      const existing = this.receipts.get(key);
      if (existing) { existing.attempts += 1; rows = [{ id: existing.id, processing_status: existing.processing_status }]; }
      else {
        const receipt = { id: `receipt-${this.receipts.size + 1}`, processing_status: sql.includes("'irrelevant'") ? "ignored" : "received", attempts: 1 };
        this.receipts.set(key, receipt); rows = [{ id: receipt.id, processing_status: receipt.processing_status }];
      }
    } else if (sql.startsWith("SELECT id, order_id")) rows = [{ ...this.payment }];
    else if (sql.startsWith("UPDATE payments")) this.payment.status = String(values[0]);
    else if (sql.startsWith("SELECT id, status FROM orders")) rows = [{ ...this.order }];
    else if (sql.startsWith("UPDATE orders")) this.order.status = String(values[0]);
    else if (sql.startsWith("INSERT INTO outbox_events")) this.outbox.add(String(values[0]));
    else if (sql.startsWith("UPDATE webhook_events")) {
      const receipt = [...this.receipts.values()].find((item) => item.id === values[1]);
      if (receipt) receipt.processing_status = String(values[0]);
    }
    return { rowCount: rows.length, rows: rows as Row[] };
  }
}

const webhookInput = { rawBody: new TextEncoder().encode("id=tr_1"), headers: { "content-type": "application/x-www-form-urlencoded" }, endpointUrl: "https://api.cyph1.co.uk/webhooks/mollie" };
const verified = (eventId: string): VerifiedWebhook => ({ outcome: "actionable", provider: "mollie-test", providerEventId: eventId, payload: {} });
const event = (eventId: string, type: PaymentEvent["type"]): PaymentEvent => ({ eventId, provider: "mollie-test", providerPaymentId: "tr_1", type, occurredAt: "2026-08-29T12:00:00Z", amount: money(12_000, "GBP") });

test("webhook processing atomically advances payment/order and creates one downstream event", async () => {
  const database = new MemoryDatabase();
  let current = event("payment:tr_1:paid", "payment.paid");
  const unsupported = async (): Promise<never> => { throw new Error("not used"); };
  const provider: PaymentProvider = {
    key: "mollie-test", createCheckout: unsupported, getPayment: unsupported, refund: unsupported,
    verifyWebhook: async () => verified(current.eventId), normaliseWebhook: async () => [current],
  };
  const processor = new PaymentWebhookProcessor(provider, database);

  const first = await processor.process(webhookInput, "33333333-3333-4333-8333-333333333333");
  const duplicate = await processor.process(webhookInput, "33333333-3333-4333-8333-333333333333");
  current = event("payment:tr_1:pending", "payment.pending");
  const stale = await processor.process(webhookInput, "33333333-3333-4333-8333-333333333333");

  assert.deepEqual(first, { acknowledgement: "processed", eventCount: 1 });
  assert.deepEqual(duplicate, { acknowledgement: "duplicate", eventCount: 0 });
  assert.deepEqual(stale, { acknowledgement: "ignored", eventCount: 0 });
  assert.equal(database.payment.status, "captured");
  assert.equal(database.order.status, "paid");
  assert.equal(database.outbox.size, 1);
  assert.equal(database.receipts.get("payment:tr_1:paid")?.attempts, 2);
  assert.equal(database.receipts.get("payment:tr_1:pending")?.processing_status, "ignored");
  assert.equal(database.rawBodies[0]?.toString(), "id=tr_1");
});
