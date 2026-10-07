import { createHash } from "node:crypto";
import type { TransactionalCommunicationProvider, TransactionalMessage } from "../../../../packages/commerce-core/src/index.js";
import { CommunicationFailure } from "./failure.js";
import { emailAddress } from "./config.js";
export type BrevoConfiguration = Readonly<{ apiKey: string; fromAddress: string; fromName: string; replyTo: string }>;
// Fixed endpoint, no redirects and no internal retries. Test transport is injected.
export class BrevoCommunicationProvider implements TransactionalCommunicationProvider {
  readonly key = "brevo";
  constructor(private readonly config: BrevoConfiguration, private readonly transport: typeof fetch = fetch, private readonly timeoutMs = 10_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new Error("Invalid Brevo timeout.");
    emailAddress(config.fromAddress, "From address"); emailAddress(config.replyTo, "Reply-To address");
    if (!config.apiKey || /\s/.test(config.apiKey) || config.apiKey.length > 512 || !config.fromName || config.fromName.length > 100 || /[\u0000-\u001f\u007f]/.test(config.fromName)) throw new Error("Invalid Brevo configuration.");
  }
  async send(message: TransactionalMessage) {
    try { emailAddress(message.recipient, "recipient"); } catch { throw new CommunicationFailure("permanent", "invalid_recipient"); }
    if (!message.idempotencyKey || /[\r\n]/.test(message.subject)) throw new CommunicationFailure("permanent", "invalid_message");
    const hash = createHash("sha256").update(message.idempotencyKey).digest("hex");
    const identity = `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new CommunicationFailure("ambiguous", "provider_timeout")); }, this.timeoutMs); });
    const request = async () => {
      const response = await this.transport("https://api.brevo.com/v3/smtp/email", {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json", "api-key": this.config.apiKey },
        body: JSON.stringify({ sender: { email: this.config.fromAddress, name: this.config.fromName },
          replyTo: { email: this.config.replyTo }, to: [{ email: message.recipient }], subject: message.subject,
          htmlContent: message.html, textContent: message.text, headers: { idempotencyKey: identity } }),
      });
      if (response.status !== 201) void response.body?.cancel().catch(() => {});
      // A rate-limit rejection is definite and retryable. Other 4xx are terminal;
      // timeout/conflict can reflect an accepted request and require reconciliation.
      if (response.status === 429) throw new CommunicationFailure("retryable", "provider_rate_limited");
      if (response.status === 408 || response.status === 409) throw new CommunicationFailure("ambiguous", "provider_uncertain");
      if (response.status >= 400 && response.status < 500) throw new CommunicationFailure("permanent", "provider_rejected");
      if (response.status !== 201) throw new CommunicationFailure("ambiguous", "provider_uncertain");
      // Read a bounded response rather than persist/log the provider body.
      const reader = response.body?.getReader();
      if (!reader) throw new CommunicationFailure("ambiguous", "provider_invalid_response");
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length;
          if (length > 8192) throw new CommunicationFailure("ambiguous", "provider_invalid_response"); chunks.push(part.value); }
      } finally { await reader.cancel().catch(() => {}); }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const id = value && typeof value === "object" && "messageId" in value ? value.messageId : undefined;
      if (typeof id !== "string" || !id || id.length > 512 || /[\u0000-\u0020\u007f]/.test(id)) throw new CommunicationFailure("ambiguous", "provider_invalid_response");
      return Object.freeze({ providerReference: id, acceptedAt: new Date().toISOString() });
    };
    try { return await Promise.race([request(), timedOut]); }
    catch (error) { if (error instanceof CommunicationFailure) throw error; throw new CommunicationFailure("ambiguous", "provider_transport_uncertain"); }
    finally { clearTimeout(timer); }
  }
}
