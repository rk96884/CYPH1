import type { TransactionalMessage, TransactionalTemplateKey } from "../../../../packages/commerce-core/src/index.js";

export type CommunicationContext = Readonly<{
  template: TransactionalTemplateKey; deduplicationKey: string; recipient: string; orderNumber: string;
  currency: string; totalMinor?: number; refundMinor?: number; trackingCarrier?: string; trackingReference?: string;
}>;

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);

type TemplateCopy = Readonly<{ subject: string; eyebrow: string; heading: string; body: string; detail?: string }>;

const copyFor = (context: CommunicationContext): TemplateCopy => {
  const order = escape(context.orderNumber);
  if (context.template === "order-confirmation") return {
    subject: `CYPH/1 order ${context.orderNumber} confirmed`,
    eyebrow: "ORDER CONFIRMED",
    heading: "Thank you for your order.",
    body: `We have received payment for order <strong>${order}</strong>${context.totalMinor === undefined ? "" : `, totalling <strong>${money(context.totalMinor, context.currency)}</strong>`}. We will contact you again when your order is dispatched.`,
  };
  if (context.template === "dispatch") {
    const tracking = context.trackingReference
      ? `Tracking reference: <strong>${escape(context.trackingReference)}</strong>${context.trackingCarrier ? ` · ${escape(context.trackingCarrier)}` : ""}`
      : undefined;
    return {
      subject: `CYPH/1 order ${context.orderNumber} dispatched`,
      eyebrow: "ORDER DISPATCHED",
      heading: "Your CYPH/1 order is on its way.",
      body: `Order <strong>${order}</strong> has been dispatched.`,
      ...(tracking ? { detail: tracking } : {}),
    };
  }
  if (context.template === "cancellation") return {
    subject: `CYPH/1 order ${context.orderNumber} cancelled`,
    eyebrow: "ORDER CANCELLED",
    heading: "Your order has been cancelled.",
    body: `Order <strong>${order}</strong> has been cancelled. If a payment was taken, any applicable refund will be confirmed separately.`,
  };
  return {
    subject: `Refund confirmed for CYPH/1 order ${context.orderNumber}`,
    eyebrow: "REFUND CONFIRMED",
    heading: "Your refund has been completed.",
    body: `A refund${context.refundMinor === undefined ? "" : ` of <strong>${money(context.refundMinor, context.currency)}</strong>`} has been completed for order <strong>${order}</strong>.`,
    detail: "Your bank or payment provider may take additional time to show the refund in your account.",
  };
};

const plain = (html: string) => html.replace(/<strong>/g, "").replace(/<\/strong>/g, "");

export const renderTransactionalMessage = (context: CommunicationContext): TransactionalMessage => {
  const copy = copyFor(context);
  const textBody = plain(copy.body);
  const textDetail = copy.detail ? `\n\n${plain(copy.detail)}` : "";
  const text = `CYPH/1 — Cycle. Phase. One.\n\n${copy.heading}\n\n${textBody}${textDetail}\n\nThis is a transactional message about your order.\nPlease keep this email for your records.`;
  const html = `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0711;color:#f7f3fb;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0b0711"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#15101d;border:1px solid #382a45;border-radius:16px;overflow:hidden">
<tr><td style="padding:36px 32px 24px">
<div style="font-size:24px;font-weight:700;letter-spacing:.08em;color:#ffffff">CYPH<span style="color:#b78af2">/1</span></div>
<div style="margin-top:6px;font-size:11px;letter-spacing:.18em;color:#bbaac8">CYCLE. PHASE. ONE.</div>
</td></tr>
<tr><td style="padding:0 32px 36px">
<div style="font-size:11px;font-weight:700;letter-spacing:.16em;color:#b78af2;margin-bottom:14px">${copy.eyebrow}</div>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#ffffff;font-weight:600">${escape(copy.heading)}</h1>
<p style="margin:0;font-size:16px;line-height:1.65;color:#eee7f3">${copy.body}</p>
${copy.detail ? `<div style="margin-top:22px;padding:16px 18px;background:#201729;border-radius:10px;font-size:14px;line-height:1.55;color:#d7ccde">${copy.detail}</div>` : ""}
</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #382a45">
<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#aa9bb4">This is a transactional message about your CYPH/1 order.</p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#7f7089">Please keep this email for your records.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return Object.freeze({ idempotencyKey: `communication:${context.deduplicationKey}`, recipient: context.recipient, template: context.template, subject: copy.subject, text, html });
};
