import { TransactionalCommunicationConsumer } from "../../../build/commerce-api/apps/commerce-api/src/communications/service.js";

/** One synthetic event; NO database, Hyperdrive, Brevo, fulfilment or payment operations. */
export async function runSyntheticConsumer(env) {
  if (env?.SYNTHETIC_CPU_TEST_ENABLED !== "true") return { status: "disabled" };
  let claimed = false;
  const repository = {
    async claimNext() {
      if (claimed) return undefined;
      claimed = true;
      return { deliveryId: "synthetic", claimToken: "synthetic", template: "order-confirmation",
        deduplicationKey: "synthetic:one", recipient: "nobody@example.invalid", orderNumber: "TEST-001",
        currency: "GBP", totalMinor: 7499, items: [{ name: "Synthetic IPL", quantity: 1, lineTotalMinor: 7499 }] };
    },
    async beginSend() {},
    async markSent() {},
    async markFailed() { throw new Error("Synthetic consumer failed"); },
    async markReview() { throw new Error("Synthetic consumer requires review"); },
  };
  const provider = { key: "synthetic-no-send", async send(message) {
    if (!message.html || !message.text || !message.subject.includes("TEST-001")) throw new Error("Invalid synthetic rendering");
    // No fetch() or external provider call. Receipt is fictional.
    return { providerReference: "synthetic-only" };
  }};
  const consumer = new TransactionalCommunicationConsumer(true, repository, provider);
  const started = performance.now();
  const result = await consumer.consumeOne();
  if (result.outcome !== "sent") throw new Error("Synthetic consumer outcome unexpected");
  return { status: "verified", wallMs: Math.round((performance.now() - started) * 1000) / 1000 };
}

export default {
  async scheduled(event, env) {
    if (event?.cron !== "__manual_synthetic_cpu_test__") return;
    const result = await runSyntheticConsumer(env);
    console.log(JSON.stringify({event:"synthetic_commerce_cpu_probe",...result}));
  },
  async fetch() { return new Response("Not found", { status: 404 }); },
};
