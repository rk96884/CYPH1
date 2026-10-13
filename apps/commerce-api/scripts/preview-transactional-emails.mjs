import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderTransactionalMessage } from "../../../build/commerce-api/apps/commerce-api/src/communications/templates.js";

const output = resolve(process.cwd(), "tmp/transactional-email-previews");
await mkdir(output, { recursive: true });
const common = {
  recipient: "preview@example.test",
  currency: "GBP",
  orderPlacedAt: "2026-10-13T15:30:00.000Z",
};
const preview = async (filename, details) => {
  const message = renderTransactionalMessage({ ...common, ...details }, { preview: true });
  // Resolve shared artwork locally without depending on a deployment.
  const html = message.html.replaceAll('src="https://cyph1.co.uk/brand/email/', 'src="../../public/brand/email/');
  await writeFile(resolve(output, filename + ".html"), html, "utf8");
  await writeFile(resolve(output, filename + ".txt"), message.text, "utf8");
};
// Preview values only. Live emails use persisted order snapshots, never these examples.
const device = (quantity) => ({
  name: "CYPH/1 IPL Hair Removal Device",
  quantity,
  lineTotalMinor: 7499 * quantity,
});
const home = {
  template: "order-confirmation",
  deduplicationKey: "preview:home-order",
  orderNumber: "CYPH-PREVIEW-HOME",
  items: [device(3)],
  deliveryMinor: 799,
  totalMinor: 23296,
  deliveryMethod: "UK tracked home delivery",
  shippingCountryCode: "GB",
};
const collection = {
  template: "order-confirmation",
  deduplicationKey: "preview:inpost-order",
  orderNumber: "CYPH-PREVIEW-COLLECTION",
  items: [device(2)],
  deliveryMinor: 259,
  totalMinor: 15257,
  deliveryMethod: "InPost Medium collection",
  shippingCountryCode: "GB",
  collectionPoint: {
    name: "Example collection shop",
    address: "Example Street, London",
    postalCode: "SW1A 1AA",
  },
};
await preview("order-confirmation-home-3", home);
await preview("order-confirmation-inpost-2", collection);
await preview("order-confirmation", { ...home, deduplicationKey: "preview:order-default" });
await preview("dispatch", {
  ...collection,
  template: "dispatch",
  deduplicationKey: "preview:dispatch",
  trackingCarrier: "Delivery carrier placeholder",
  trackingReference: "Tracking reference placeholder",
  trackingUrl: "https://tracking-placeholder.invalid/PREVIEW-ONLY",
});
await preview("cancellation", { ...home, template: "cancellation", deduplicationKey: "preview:cancellation" });
await preview("refund", { ...home, template: "refund", deduplicationKey: "preview:refund", refundMinor: home.totalMinor });
console.log("Transactional email previews written to " + output + " (illustrative only; no messages sent).");
