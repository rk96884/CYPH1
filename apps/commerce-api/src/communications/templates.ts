import type { TransactionalMessage, TransactionalTemplateKey } from "../../../../packages/commerce-core/src/index.js";

export type CommunicationContext = Readonly<{
  template: TransactionalTemplateKey; deduplicationKey: string; recipient: string; orderNumber: string;
  currency: string; totalMinor?: number; refundMinor?: number; trackingCarrier?: string; trackingReference?: string;
}>;
const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);

export const renderTransactionalMessage = (context: CommunicationContext): TransactionalMessage => {
  const order = escape(context.orderNumber);
  let subject = "An update about your CYPH/1 order";
  let body = `An update is available for order ${order}.`;
  if (context.template === "order-confirmation") {
    subject = `CYPH/1 order ${context.orderNumber} confirmed`;
    body = `We have received payment for order ${order}${context.totalMinor === undefined ? "" : `, totalling ${money(context.totalMinor, context.currency)}`}. We will contact you again when it is dispatched.`;
  } else if (context.template === "dispatch") {
    subject = `CYPH/1 order ${context.orderNumber} dispatched`;
    const tracking = context.trackingReference ? ` Tracking reference: ${escape(context.trackingReference)}${context.trackingCarrier ? ` (${escape(context.trackingCarrier)})` : ""}.` : "";
    body = `Order ${order} has been dispatched.${tracking}`;
  } else if (context.template === "cancellation") {
    subject = `CYPH/1 order ${context.orderNumber} cancelled`;
    body = `Order ${order} has been cancelled. If a payment was taken, any applicable refund will be confirmed separately.`;
  } else if (context.template === "refund") {
    subject = `Refund confirmed for CYPH/1 order ${context.orderNumber}`;
    body = `A refund${context.refundMinor === undefined ? "" : ` of ${money(context.refundMinor, context.currency)}`} has been completed for order ${order}. Your payment provider may take additional time to show it.`;
  }
  const text = `CYPH/1 — Cycle. Phase. One.\n\n${body}\n\nThis is a transactional message about your order.`;
  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;background:#0b0711;color:#f7f3fb;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:40px 24px"><p style="color:#a779ef;letter-spacing:.12em">CYPH/1</p><h1 style="font-size:28px">${escape(subject)}</h1><p style="font-size:16px;line-height:1.6">${body}</p><hr style="border:0;border-top:1px solid #4a3657;margin:32px 0"><p style="color:#c9bdcf;font-size:12px">Transactional order message · Cycle. Phase. One.</p></div></body></html>`;
  return Object.freeze({ idempotencyKey: `communication:${context.deduplicationKey}`, recipient: context.recipient, template: context.template, subject, text, html });
};
