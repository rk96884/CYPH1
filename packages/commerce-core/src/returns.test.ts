import assert from "node:assert/strict";
import test from "node:test";
import { transitionReturn, returnQuantity, assertReturnClosure, ReturnDomainError, returnCategories, type ReturnStatus, type ReturnAction } from "./returns.js";

test("return lifecycle is merchandise-only and valid transitions are explicit", () => {
  assert.equal(transitionReturn("requested", "approve"), "approved");
  assert.equal(transitionReturn("approved", "receive"), "received");
  assert.equal(transitionReturn("received", "inspect"), "received");
  assert.equal(transitionReturn("received", "receive"), "received");
  assert.equal(transitionReturn("received", "close"), "closed");
  assert.equal(transitionReturn("requested", "reject"), "rejected");
  assert.equal(transitionReturn("requested", "cancel"), "cancelled");
  assert.equal(transitionReturn("approved", "close", true), "closed");
});
test("invalid return transitions and terminal actions fail closed", () => {
  for (const state of ["closed", "cancelled", "rejected"] as ReturnStatus[]) for (const action of ["approve", "reject", "cancel", "receive", "inspect", "close"] as ReturnAction[]) assert.throws(() => transitionReturn(state, action), ReturnDomainError);
  for (const [state, action] of [["requested", "receive"], ["requested", "close"], ["approved", "approve"], ["approved", "close"], ["approved", "inspect"], ["received", "cancel"]] as const) assert.throws(() => transitionReturn(state, action), ReturnDomainError);
  assert.throws(() => transitionReturn("approved", "receive", true), ReturnDomainError);
});
test("return quantities are bounded integer counts", () => {
  assert.equal(returnQuantity(2), 2); assert.equal(returnQuantity(0, true), 0);
  for (const value of [0, -1, 0.5, "1", NaN, Infinity, 2147483648]) assert.throws(() => returnQuantity(value), ReturnDomainError);
});
test("return closure requires explicit financial settlement and separate inspection", () => {
  const base = { approvedRefundMinor: 100, inspected: true, receiptWaived: false, currency: "GBP", refunds: [{ status: "completed", amountMinor: 100, currency: "GBP" }] };
  assert.equal(assertReturnClosure(base), "refund_completed");
  assert.throws(() => assertReturnClosure({ ...base, approvedRefundMinor: null }), /explicit monetary/);
  assert.throws(() => assertReturnClosure({ ...base, inspected: false }), /separate inspection/);
  assert.throws(() => assertReturnClosure({ ...base, refunds: [] }), /not satisfied/);
  for (const status of ["pending", "created", "resolution_required", "unknown"]) assert.throws(() => assertReturnClosure({ ...base, refunds: [{ ...base.refunds[0]!, status }] }), /resolved/);
  assert.throws(() => assertReturnClosure({ ...base, refunds: [{ status: "completed", amountMinor: 100, currency: "EUR" }] }), /resolved/);
  assert.throws(() => assertReturnClosure({ ...base, refunds: [{ ...base.refunds[0]!, amountMinor: 99 }] }), /not satisfied/);
});
test("zero-refund and receipt-waived decisions do not imply money movement", () => {
  assert.equal(assertReturnClosure({ approvedRefundMinor: 0, inspected: false, receiptWaived: true, currency: "GBP", refunds: [] }), "no_refund_due");
  assert.equal(assertReturnClosure({ approvedRefundMinor: 0, inspected: true, receiptWaived: false, currency: "GBP", refunds: [] }), "no_refund_due");
  assert.ok(returnCategories.includes("fault_reported")); assert.ok(!returnCategories.some((category) => String(category) === "defective"));
});
