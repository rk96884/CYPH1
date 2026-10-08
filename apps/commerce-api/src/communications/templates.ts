import { importChargesNotice } from "../../../../packages/commerce-core/src/index.js";
import type { TransactionalMessage, TransactionalTemplateKey } from "../../../../packages/commerce-core/src/index.js";

export type CommunicationContext = Readonly<{
  template: TransactionalTemplateKey; deduplicationKey: string; recipient: string; orderNumber: string;
  currency: string; totalMinor?: number; refundMinor?: number; trackingCarrier?: string; trackingReference?: string;
  trackingUrl?: string;
  shippingCountryCode?: string;
  orderPlacedAt?: string; deliveryMethod?: string; deliveryMinor?: number; expectedDelivery?: string;
  items?: readonly Readonly<{ name: string; quantity: number; lineTotalMinor: number }>[];
}>;

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(value));
const website = "https://cyph1.co.uk";
const logo = `${website}/brand/email/cyph1-lockup.png`;

type TemplateCopy = Readonly<{ subject: string; eyebrow: string; heading: string; body: string; detail?: string }>;

const copyFor = (context: CommunicationContext): TemplateCopy => {
  const order = escape(context.orderNumber);
  if (context.template === "order-confirmation") return {
    subject: `CYPH/1 order ${context.orderNumber} confirmed`,
    eyebrow: "ORDER CONFIRMED",
    heading: "Thank you for your order.",
    body: `We received payment for order <strong>${order}</strong>${context.orderPlacedAt ? `, placed on ${escape(date(context.orderPlacedAt))}` : ""}. We'll contact you again when your order is dispatched.`,
  };
  if (context.template === "dispatch") {
    return {
      subject: `CYPH/1 order ${context.orderNumber} dispatched`,
      eyebrow: "ORDER DISPATCHED",
      heading: "Your CYPH/1 order is on its way.",
      body: `Order <strong>${order}</strong> has been dispatched.`,
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

const plain = (html: string) => html.replace(/<\/?strong>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[entity]!);

const validTrackingUrl = (value: string | undefined, preview: boolean): string | undefined => {
  if (!value || !/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    // Reserved non-resolving preview hosts must never appear in real messages.
    const hostname = url.hostname.replace(/\.$/, "");
    if ((hostname === "invalid" || hostname.endsWith(".invalid")) && !preview) return undefined;
    return url.href;
  } catch { return undefined; }
};

const dispatchTracking = (context: CommunicationContext, preview: boolean) => {
  if (context.template !== "dispatch") return { html: "", text: "" };
  const trackingUrl = validTrackingUrl(context.trackingUrl, preview);
  const lines = [
    context.trackingCarrier ? `Carrier: <strong>${escape(context.trackingCarrier)}</strong>` : "",
    context.trackingReference ? `Tracking number: <strong>${escape(context.trackingReference)}</strong>` : "",
  ].filter(Boolean);
  const expected = context.expectedDelivery ? `Expected delivery: ${escape(context.expectedDelivery)}` : "";
  const placeholder = trackingUrl && new URL(trackingUrl).hostname.replace(/\.$/, "").endsWith(".invalid");
  return {
    html: `${lines.map((line) => `<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#d7ccde;overflow-wrap:anywhere">${line}</p>`).join("")}${trackingUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td bgcolor="#b78af2" style="background:#b78af2;border:1px solid #b78af2"><a href="${escape(trackingUrl)}" title="Track your delivery with the delivery carrier" style="display:inline-block;padding:14px 22px;border:1px solid #b78af2;mso-padding-alt:14px 22px;font-size:15px;font-weight:700;line-height:1.4;text-decoration:none;color:#0b0711">Track your delivery</a></td></tr></table>` : ""}${placeholder ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#d7ccde">PREVIEW ONLY — placeholder tracking URL; no carrier destination is configured.</p>` : ""}${expected ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#d7ccde">${expected}</p>` : ""}`,
    text: `${lines.length ? `\n${lines.map(plain).join("\n")}` : ""}${trackingUrl ? `\n\nTrack your delivery: ${trackingUrl}` : ""}${placeholder ? "\nPREVIEW ONLY — placeholder tracking URL; no carrier destination is configured." : ""}${expected ? `\n\n${plain(expected)}` : ""}`,
  };
};

const orderBreakdown = (context: CommunicationContext) => {
  if (context.template !== "order-confirmation") return { html: "", text: "" };
  const rows = [...(context.items ?? [])];
  if (context.deliveryMinor !== undefined) rows.push({ name: context.deliveryMethod ?? "Delivery", quantity: 1, lineTotalMinor: context.deliveryMinor });
  const htmlRows = rows.map((item) => `<tr><td style="padding:14px 8px 14px 0;border-bottom:1px solid #382a45;overflow-wrap:anywhere">${escape(item.name)}</td><td align="center" style="padding:14px 8px;border-bottom:1px solid #382a45">${escape(String(item.quantity))}</td><td align="right" style="padding:14px 0 14px 8px;border-bottom:1px solid #382a45;white-space:nowrap">${escape(money(item.lineTotalMinor, context.currency))}</td></tr>`).join("");
  const total = context.totalMinor === undefined ? "" : money(context.totalMinor, context.currency);
  const expected = context.expectedDelivery ? `Expected delivery: ${escape(context.expectedDelivery)}` : "";
  return {
    html: `<table aria-label="Order breakdown" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;border-collapse:collapse;font-size:14px;line-height:1.6;color:#eee7f3"><thead><tr><th scope="col" align="left" style="padding:0 8px 10px 0;border-bottom:1px solid #76598c">Item</th><th scope="col" align="center" style="padding:0 8px 10px;border-bottom:1px solid #76598c">Qty</th><th scope="col" align="right" style="padding:0 0 10px 8px;border-bottom:1px solid #76598c">Price</th></tr></thead><tbody>${htmlRows}</tbody>${total ? `<tfoot><tr><th scope="row" colspan="2" align="left" style="padding:20px 8px 10px 0;border-top:2px solid #76598c;font-size:16px;color:#ffffff">Total amount paid</th><td align="right" style="padding:20px 0 10px 8px;border-top:2px solid #76598c;font-size:16px;font-weight:700;color:#ffffff;white-space:nowrap">${escape(total)}</td></tr></tfoot>` : ""}</table>${expected ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#d7ccde">${expected}</p>` : ""}`,
    text: `\n\nItem | Qty | Price\n${rows.map((item) => `${item.name} | ${item.quantity} | ${money(item.lineTotalMinor, context.currency)}`).join("\n")}${total ? `\nTotal amount paid | ${total}` : ""}${expected ? `\n\n${plain(expected)}` : ""}`,
  };
};

const socials = [
  ["Instagram", "https://www.instagram.com/cyph1uk/"],
  ["TikTok", "https://www.tiktok.com/@cyph1uk"],
  ["Facebook", "https://www.facebook.com/profile.php?id=61593666869093"],
  ["LinkedIn", "https://www.linkedin.com/company/146602804/"],
  ["YouTube", "https://www.youtube.com/@CY-PH-1"],
  ["X", "https://x.com/cyph1uk"],
] as const;
const socialLinks = `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${socials.map(([name, href]) => `<td><a href="${escape(href)}" style="display:inline-block;padding:10px 4px"><img src="${website}/brand/email/${name.toLowerCase()}.png" width="24" height="24" alt="${name}" style="display:block;border:0;color:#b78af2;font-size:10px"></a></td>`).join("")}</tr></table>`;

export const renderTransactionalMessage = (context: CommunicationContext, options?: Readonly<{ preview: true }>): TransactionalMessage => {
  // The delivery consumer never enables previews. Require isolated preview fixtures too.
  const preview = options?.preview === true && context.recipient === "preview@example.test" && context.deduplicationKey.startsWith("preview:");
  const copy = copyFor(context);
  const breakdown = orderBreakdown(context);
  const tracking = dispatchTracking(context, preview);
  const importNotice = context.shippingCountryCode && context.shippingCountryCode !== "GB" && ["order-confirmation", "dispatch"].includes(context.template) ? importChargesNotice : "";
  const textBody = plain(copy.body);
  const textDetail = copy.detail ? `\n\n${plain(copy.detail)}` : "";
  const text = `CYPH/1 — Cycle. Phase. One.\n\n${copy.heading}\n\n${textBody}${breakdown.text}${tracking.text}${importNotice ? `\n\n${importNotice}` : ""}${textDetail}\n\nThis is a transactional message about your order.\nPlease keep this email for your records.`;
  const html = `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0711;color:#f7f3fb;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0b0711"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#15101d;border:1px solid #382a45;border-radius:16px;overflow:hidden">
<tr><td style="padding:36px 32px 24px 21px">
<a href="${website}"><img src="${logo}" width="240" alt="CYPH/1 — CYCLE. PHASE. ONE." style="display:block;width:240px;max-width:100%;height:auto;border:0;color:#f7f3fb"></a>
</td></tr>
<tr><td style="padding:0 32px 36px">
<div style="font-size:11px;font-weight:700;letter-spacing:.16em;color:#b78af2;margin-bottom:14px">${copy.eyebrow}</div>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#ffffff;font-weight:600">${escape(copy.heading)}</h1>
<p style="margin:0;font-size:16px;line-height:1.65;color:#eee7f3">${copy.body}</p>
${breakdown.html}
${tracking.html}
${importNotice ? `<p style="margin-top:18px;font-size:14px;line-height:1.6;color:#d7ccde">${escape(importNotice)}</p>` : ""}
${copy.detail ? `<div style="margin-top:22px;padding:16px 18px;background:#201729;border-radius:10px;font-size:14px;line-height:1.75;color:#d7ccde">${copy.detail}</div>` : ""}
</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #382a45">
<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#aa9bb4">This is a transactional message about your CYPH/1 order.</p>
<p style="margin:0 0 12px;font-size:11px;line-height:1.6;color:#7f7089">CYPH1 LTD · Unit 171614, PO Box 7169 · Poole, BH15 9EL · United Kingdom<br>Company number 17455968</p>\n${socialLinks}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return Object.freeze({ idempotencyKey: `communication:${context.deduplicationKey}`, recipient: context.recipient, template: context.template, subject: copy.subject, text, html });
};
