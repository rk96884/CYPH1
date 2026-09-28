import assert from "node:assert/strict";
import test from "node:test";
import { money, type NormalisedPayment, type PaymentProvider } from "../../../../packages/commerce-core/src/index.js";
import { captureDeadlineState, loadCaptureDeadlineConfig, providerTimestamp } from "./capture-deadline.js";
import { CaptureDeadlineMonitor, type CaptureMonitorObservation, type CaptureMonitorRepository } from "./capture-monitor.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";

const config = loadCaptureDeadlineConfig({});
const now = new Date("2026-09-28T12:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60000).toISOString();

for (const [minutes, expected] of [[1441, "safe"], [1440, "warning"], [361, "warning"], [360, "critical"], [1, "critical"], [0, "overdue"], [-1, "overdue"]] as const) {
  test(`deadline at ${minutes} minutes classifies as ${expected}`, () => {
    assert.equal(captureDeadlineState("manual", at(minutes), now, config), expected);
  });
}
test("missing deadline is actionable and never manufactured; unknown mode needs reconciliation", () => {
  assert.equal(captureDeadlineState("manual", null, now, config), "missing_deadline");
  assert.equal(captureDeadlineState(null, at(10000), now, config), "reconciliation_required");
  for (const value of ["invalid", "2026-10-01", "2026-10-01T00:00:00", "2026-13-45T00:00:00Z", "2026-02-30T00:00:00Z"]) assert.throws(() => providerTimestamp(value), /invalid_provider_timestamp/);
});
test("deadline policy validates integers and critical must be inside warning", () => {
  for (const value of ["", "0", "-1", "1.5", "NaN", "Infinity", " 100", "999999999999999"]) assert.throws(() => loadCaptureDeadlineConfig({ CAPTURE_DEADLINE_WARNING_MINUTES: value }));
  assert.throws(() => loadCaptureDeadlineConfig({ CAPTURE_DEADLINE_WARNING_MINUTES: "60", CAPTURE_DEADLINE_CRITICAL_MINUTES: "60" }));
  assert.throws(() => loadCaptureDeadlineConfig({ CAPTURE_DEADLINE_WARNING_MINUTES: "60", CAPTURE_DEADLINE_CRITICAL_MINUTES: "61" }));
  assert.throws(() => loadCaptureDeadlineConfig({ CAPTURE_DEADLINE_MAX_PAYMENTS: "0" }));
  assert.deepEqual(loadCaptureDeadlineConfig({ CAPTURE_DEADLINE_WARNING_MINUTES: "120", CAPTURE_DEADLINE_CRITICAL_MINUTES: "30", CAPTURE_DEADLINE_MAX_PAYMENTS: "2" }), { warningMinutes: 120, criticalMinutes: 30, maxPayments: 2 });
});

const payment: NormalisedPayment = { provider: "mollie-test", providerPaymentId: "tr_test", orderId: "o1", status: "authorised", captureMode: "manual", captureBefore: at(100), authorisedAt: at(-1000), amount: money(1000, "GBP"), refundableAmount: money(0, "GBP"), createdAt: at(-1000) };
function fixture(read: () => Promise<NormalisedPayment>) {
  const observations: CaptureMonitorObservation[] = []; let reads = 0; let captures = 0; let claims = 0;
  const unused = async (): Promise<never> => { throw new Error("unused"); };
  const provider: PaymentProvider = { key: "mollie-test", createCheckout: unused, refund: unused, verifyWebhook: unused, normaliseWebhook: unused,
    capture: async () => { captures++; throw new Error("monitor must never capture"); },
    getPayment: async (input) => { reads++; assert.equal(input.providerPaymentId, "tr_test"); assert.equal(input.correlationId, "11111111-1111-4111-8111-111111111111"); return read(); } };
  const repository: CaptureMonitorRepository = {
    claim: async (started, clock, claimId) => { assert.equal(started.toISOString(), now.toISOString()); assert.equal(clock.toISOString(), now.toISOString()); return claims++ === 0 ? { id: "p1", orderId: "o1", provider: "mollie-test", providerPaymentId: "tr_test", amountMinor: 1000, currency: "GBP", revision: "0", claimId } : undefined; },
    record: async (_claim, observation) => { observations.push(observation); return "recorded"; },
    summary: async () => ({ conditions: { critical: 1 }, remaining: 0 }),
  };
  const monitor = new CaptureDeadlineMonitor(repository, { getProvider: () => provider, getConfiguredProvider: () => provider }, config, () => now);
  return { monitor, repository, observations, counters: () => ({ reads, captures }) };
}

test("monitor refreshes through getPayment and never invokes capture, even overdue", async () => {
  const overdue = { ...payment, captureBefore: at(-1) };
  const f = fixture(async () => overdue);
  assert.equal((await f.monitor.run("11111111-1111-4111-8111-111111111111")).actionable, true);
  assert.deepEqual(f.observations, [{ payment: overdue }]);
  assert.deepEqual(f.counters(), { reads: 1, captures: 0 });
});
test("stale local authorisation can be reconciled to a provider-confirmed capture without issuing capture", async () => {
  const captured = { ...payment, status: "captured" as const };
  const f = fixture(async () => captured); await f.monitor.run("11111111-1111-4111-8111-111111111111");
  assert.deepEqual(f.observations, [{ payment: captured }]); assert.equal(f.counters().captures, 0);
});
test("unverified, mismatched or malformed provider data becomes a privacy-safe reconciliation failure", async () => {
  for (const read of [async () => { throw new Error("private customer / provider secret"); }, async () => ({ ...payment, providerPaymentId: "wrong" }), async () => ({ ...payment, amount: money(999, "GBP") }), async () => ({ ...payment, captureBefore: "invalid" })]) {
    const f = fixture(read); await f.monitor.run("11111111-1111-4111-8111-111111111111");
    assert.deepEqual(f.observations, [{ failure: "provider_verification_failed" }]); assert.equal(f.counters().captures, 0);
  }
});
test("lease/revision conflicts and incomplete coverage are actionable", async () => {
  const f = fixture(async () => payment);
  f.repository.record = async () => "conflict";
  f.repository.summary = async () => ({ conditions: { safe: 1 }, remaining: 1 });
  const result = await f.monitor.run("11111111-1111-4111-8111-111111111111");
  assert.equal(result.conflicts, 1); assert.equal(result.remaining, 1); assert.equal(result.actionable, true);
});

test("Mollie webhook timing is fetched and verified; a changed deadline has a new receipt identity", async () => {
  let deadline = at(1440); let requests = 0;
  const provider = new MollieTestPaymentProvider({ apiKey: "test_capture_monitor", allowedCallbackOrigins: ["https://api.example"], fetch: async (url) => {
    requests++;
    return new Response(JSON.stringify(String(url).endsWith("/refunds") ? { _embedded: { refunds: [] } } : { id: "tr_test", status: "authorised", captureMode: "manual", captureBefore: deadline, authorisedAt: at(-1000), createdAt: at(-2000), amount: { value: "10.00", currency: "GBP" } }));
  } });
  const input = { rawBody: new TextEncoder().encode("id=tr_test"), headers: { "content-type": "application/x-www-form-urlencoded" }, endpointUrl: "https://api.example/webhooks/mollie" };
  const first = (await provider.normaliseWebhook(await provider.verifyWebhook(input)))[0]!;
  assert.equal(first.captureBefore, deadline); assert.equal(first.authorisedAt, at(-1000)); assert.equal(first.captureMode, "manual");
  deadline = at(2400);
  const second = (await provider.normaliseWebhook(await provider.verifyWebhook(input)))[0]!;
  assert.notEqual(first.eventId, second.eventId); assert.equal(second.captureBefore, deadline); assert.equal(requests, 4);
  assert.equal((await provider.verifyWebhook({ ...input, rawBody: new TextEncoder().encode("id=tr_test&captureBefore=2099-01-01") })).outcome, "malformed");
  assert.equal(requests, 4);
});
