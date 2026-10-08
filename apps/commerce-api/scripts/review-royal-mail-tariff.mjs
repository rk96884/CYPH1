// Offline preview by default. Import is deliberately non-production and always disabled.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { parseTariffSchedule, tariffChanges, previewTariff, importDisabledTariff, validateTariffImportEnvironment } from "../../../build/commerce-api/apps/commerce-api/src/checkout/tariff-import.js";
const args=process.argv.slice(2);
if (![2,3].includes(args.length) || (args[2] && args[2]!=="--import-disabled")) throw new Error("Usage: node scripts/review-royal-mail-tariff.mjs previous.json next.json [--import-disabled]");
const previous=parseTariffSchedule(JSON.parse(await readFile(args[0],"utf8")));
const next=parseTariffSchedule(JSON.parse(await readFile(args[1],"utf8")));
console.log(JSON.stringify({revision:next.revision,changes:tariffChanges(previous,next),
  preview:previewTariff(next,process.env.TARIFF_PREVIEW_PRODUCT_ID ?? "reference",953,7499,new Date()),
  warning:"Preview only; provisional packaging and synthetic dimensions/rates are not launch approval. No gates changed."},null,2));
if (args[2]) {
  validateTariffImportEnvironment(process.env,next.revision);
  const u=new URL(process.env.DATABASE_URL);
  const pool=new pg.Pool({connectionString:u.href,ssl:process.env.DATABASE_SSL === "true" ? {rejectUnauthorized:true} : undefined});
  try {const client=await pool.connect();try {await importDisabledTariff(client,next);} finally {client.release();}} finally {await pool.end();}
  console.log("Imported disabled tariff revision; no destination or checkout approval changed.");
}
