import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderTransactionalMessage } from "../../../build/commerce-api/apps/commerce-api/src/communications/templates.js";

const output=resolve(process.cwd(),"tmp/transactional-email-previews");
await mkdir(output,{recursive:true});
const base={recipient:"preview@example.test",orderNumber:"CYPH-PREVIEW-1001",currency:"GBP",totalMinor:29900,deliveryMinor:0,orderPlacedAt:"2026-10-05T15:30:00.000Z",deliveryMethod:"Standard UK Delivery",expectedDelivery:"2–3 working days"};
// Example data only: production rows come from saved order-item snapshots.
base.items=[{name:"CYPH/1 IPL Hair Removal Device",quantity:1,lineTotalMinor:29900}];
const examples=[
  {template:"order-confirmation",deduplicationKey:"preview:order"},
  // Reserved .invalid URL: preview-only, never a real/default carrier endpoint.
  {template:"dispatch",deduplicationKey:"preview:dispatch",trackingCarrier:"Delivery carrier placeholder",trackingReference:"Tracking reference placeholder",trackingUrl:"https://tracking-placeholder.invalid/PREVIEW-ONLY"},
  {template:"cancellation",deduplicationKey:"preview:cancellation"},
  {template:"refund",deduplicationKey:"preview:refund",refundMinor:29900},
];
for(const example of examples){
  const message=renderTransactionalMessage({...base,...example},{preview:true});
  // Resolve the shared artwork locally without depending on a deployment.
  const previewHtml=message.html.replaceAll('src="https://cyph1.co.uk/brand/email/', 'src="../../../../public/brand/email/');
  await writeFile(resolve(output,`${example.template}.html`),previewHtml,"utf8");
  await writeFile(resolve(output,`${example.template}.txt`),message.text,"utf8");
}
console.log(`Transactional email previews written to ${output}`);
