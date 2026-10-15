import test from "node:test";
import assert from "node:assert/strict";

test("real communication consumer produces synthetic message using fake repository/provider", async () => {
  const { TransactionalCommunicationConsumer } = await import("../../../build/commerce-api/apps/commerce-api/src/communications/service.js");
  const calls=[];
  const repository={
    async claimNext() { calls.push("claim"); return { deliveryId:"synthetic", claimToken:"synthetic-token",template:"order-confirmation",deduplicationKey:"test:synthetic",recipient:"synthetic@example.invalid",orderNumber:"TEST-001",currency:"GBP",totalMinor:7499,items:[{name:"Synthetic test item",quantity:1,lineTotalMinor:7499}] }; },
    async beginSend() {calls.push("beginSend");},
    async markSent() {calls.push("markSent");},
    async markFailed() {calls.push("markFailed");},
    async markReview() {calls.push("markReview");}
  };
  const provider={key:"synthetic",async send(message){calls.push("fakeSend");assert.match(message.subject,/TEST-001/);assert.ok(message.html.length>0);return {providerReference:"synthetic-receipt"};}};
  const consumer=new TransactionalCommunicationConsumer(true,repository,provider);
  const cpuStart=process.cpuUsage(),wallStart=performance.now();
  const result=await consumer.consumeOne();
  const cpu=process.cpuUsage(cpuStart);
  assert.equal(result.outcome,"sent");
  assert.deepEqual(calls,["claim","beginSend","fakeSend","markSent"]);
  assert.ok(cpu.user>=0&&cpu.system>=0&&performance.now()>=wallStart);
  console.log(JSON.stringify({test:"real_communication_consumer_fake_provider",outcome:result.outcome,cpuMicroseconds:cpu.user+cpu.system,remark:"Node CI CPU only, not Cloudflare Workers CPU"}));
});

test("real fulfilment service is strictly disabled with fake repository/provider", async () => {
  const { FulfilmentService }=await import("../../../build/commerce-api/apps/commerce-api/src/fulfilment/service.js");
  let called=false;
  const service=new FulfilmentService(false,{key:"synthetic",async create(){called=true;}},{async reservePaidOrder(){called=true;}});
  await assert.rejects(service.requestForPaidOrder("00000000-0000-4000-8000-000000000000","synthetic"),/disabled/);
  assert.equal(called,false);
});

test("real consumer code compiles to Worker-compatible entry without a live handler", async () => {
  const { importedContracts, default: worker }=await import("./src/actual-consumers-build-probe.mjs");
  assert.equal(importedContracts(),true);
  assert.equal((await worker.fetch()).status,404);
  await worker.scheduled();
});
