import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderTransactionalMessage } from "../src/communications/templates.js";

const output=resolve(process.cwd(),"tmp/transactional-email-previews");
await mkdir(output,{recursive:true});
const base={recipient:"preview@example.test",orderNumber:"CYPH-PREVIEW-1001",currency:"GBP",totalMinor:29900};
const examples=[
  {template:"order-confirmation",deduplicationKey:"preview:order"},
  {template:"dispatch",deduplicationKey:"preview:dispatch",trackingCarrier:"CYPH/1 Preview Carrier",trackingReference:"TRACK-123456"},
  {template:"cancellation",deduplicationKey:"preview:cancellation"},
  {template:"refund",deduplicationKey:"preview:refund",refundMinor:29900},
];
for(const example of examples){
  const message=renderTransactionalMessage({...base,...example});
  await writeFile(resolve(output,`${example.template}.html`),message.html,"utf8");
  await writeFile(resolve(output,`${example.template}.txt`),message.text,"utf8");
}
console.log(`Transactional email previews written to ${output}`);
