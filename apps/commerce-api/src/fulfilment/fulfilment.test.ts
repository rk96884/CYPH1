import assert from "node:assert/strict";
import test from "node:test";
import type { CreateFulfilmentRequest, FulfilmentProviderEvent, FulfilmentStatus } from "../../../../packages/commerce-core/src/index.js";
import { ManualTestFulfilmentProvider } from "./manual-test.js";
import { FulfilmentError, FulfilmentService, type FulfilmentRepository } from "./service.js";

const request: CreateFulfilmentRequest = {
  idempotencyKey: "fulfilment:paid-1", orderId: "order-1", orderNumber: "CYPH1-0001",
  deliveryAddress: { recipientName: "Test Customer", line1: "1 Test Street", locality: "London", postalCode: "SW1A 1AA", countryCode: "GB" },
  lines: [{ sku: "TEST-FULFILMENT-SKU", quantity: 2 }],
};

class MemoryRepository implements FulfilmentRepository {
  paid = true; reserved = false; status: FulfilmentStatus = "created"; reference?: string;
  events = new Set<string>(); failed = false;
  async reservePaidOrder() {
    if (!this.paid) throw new FulfilmentError("not_paid", "Only verified paid orders qualify.");
    if (this.reserved) return { outcome: "duplicate" as const, fulfilmentId: "fulfilment-1", request, ...(this.reference ? { providerReference: this.reference } : {}) };
    this.reserved = true; return { outcome: "reserved" as const, fulfilmentId: "fulfilment-1", request };
  }
  async confirmProviderCreation(input: Readonly<{ providerReference: string; status: "queued" | "accepted" }>) { this.reference = input.providerReference; this.status = input.status; }
  async failProviderCreation() { this.failed = true; this.status = "failed"; }
  async getFulfilment() { return this.reference ? { status: this.status } : undefined; }
  async applyProviderEvent(_provider: string, event: FulfilmentProviderEvent) {
    if (this.events.has(event.eventId)) return "duplicate" as const;
    this.events.add(event.eventId); this.status = event.status; return "applied" as const;
  }
}

test("fulfilment remains disabled unless explicitly enabled", async () => {
  const service = new FulfilmentService(false, new ManualTestFulfilmentProvider(), new MemoryRepository());
  await assert.rejects(() => service.requestForPaidOrder("order-1", "paid-1"), (error: unknown) => error instanceof FulfilmentError && error.code === "disabled");
});

test("verified paid order creates one idempotent manual-test fulfilment", async () => {
  const repository = new MemoryRepository();
  const service = new FulfilmentService(true, new ManualTestFulfilmentProvider(), repository);
  assert.deepEqual(await service.requestForPaidOrder("order-1", "paid-1"), { outcome: "created", providerReference: "manual-CYPH1-0001" });
  assert.deepEqual(await service.requestForPaidOrder("order-1", "paid-1"), { outcome: "duplicate", providerReference: "manual-CYPH1-0001" });
});

test("unpaid orders cannot cross the fulfilment boundary", async () => {
  const repository = new MemoryRepository(); repository.paid = false;
  const service = new FulfilmentService(true, new ManualTestFulfilmentProvider(), repository);
  await assert.rejects(() => service.requestForPaidOrder("order-1", "paid-1"), (error: unknown) => error instanceof FulfilmentError && error.code === "not_paid");
});

test("provider events update dispatch tracking once", async () => {
  const repository = new MemoryRepository(); repository.reference = "manual-CYPH1-0001"; repository.status = "accepted";
  const service = new FulfilmentService(true, new ManualTestFulfilmentProvider(), repository);
  const event = { eventId: "dispatch-1", providerReference: repository.reference, status: "dispatched" as const, trackingCarrier: "Test carrier", trackingReference: "TRACK-1" };
  assert.equal(await service.receiveEvent(event), "applied");
  assert.equal(await service.receiveEvent(event), "duplicate");
});

test("cancellation is pre-dispatch and returns are post-dispatch", async () => {
  const repository = new MemoryRepository(); repository.reference = "manual-CYPH1-0001"; repository.status = "accepted";
  const service = new FulfilmentService(true, new ManualTestFulfilmentProvider(), repository);
  assert.deepEqual(await service.requestCancellation(repository.reference, "cancel-1"), { outcome: "requested" });
  await assert.rejects(() => service.requestReturn(repository.reference!, "return-1"), (error: unknown) => error instanceof FulfilmentError && error.code === "requires_review");
  repository.status = "dispatched";
  assert.deepEqual(await service.requestReturn(repository.reference, "return-2"), { outcome: "requested" });
  await assert.rejects(() => service.requestCancellation(repository.reference!, "cancel-2"), (error: unknown) => error instanceof FulfilmentError && error.code === "requires_review");
});
