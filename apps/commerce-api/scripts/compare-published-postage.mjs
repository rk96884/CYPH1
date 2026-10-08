// Offline published base-postage comparison. No database, environment or eligibility changes.
import { readFile } from "node:fs/promises";
import { parseTariffSchedule, comparePublishedPostage } from "../../../build/commerce-api/apps/commerce-api/src/checkout/tariff-import.js";
if (process.argv.length !== 3) throw new Error("Usage: node apps/commerce-api/scripts/compare-published-postage.mjs tariff.json");
const schedule = parseTariffSchedule(JSON.parse(await readFile(process.argv[2], "utf8")));
const rows = comparePublishedPostage(schedule);
const columns = Object.keys(rows[0]);
const cell = value => value === null || value === undefined ? "" : `"${String(value).replaceAll('"','""')}"`;
console.log(columns.map(cell).join(","));
for (const row of rows) console.log(columns.map(column => cell(row[column])).join(","));
