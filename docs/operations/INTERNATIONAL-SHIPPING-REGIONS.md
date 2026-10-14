# CYPH/1 international shipping regions and launch containment

**Decision: 14 October 2026.** Product owner agreed six reporting/customer-facing regions and accepted that carrier costs may exceed the agreed delivery charge, to be absorbed within product margin. **USA is excluded from initial launch** because of tariff, import and duties-paid complications.

| Region | Customer price policy | Activation rule |
| --- | --- | --- |
| UK | Home £3.99 (1), £7.99 (2–3); manual InPost £2.59 (1–2), £3.99 (3) | Individually approved UK methods |
| Europe (including Turkey) | £14.99 per order | Country allowlist and carrier/customs clearance |
| Asia | £25.99 per order | Country allowlist and carrier/customs clearance |
| Middle East | £25.99 per order | Country allowlist and carrier/customs clearance |
| LATAM | £25.99 per order | Country allowlist and carrier/customs clearance |
| Rest of World | £25.99 per order | Country allowlist, excludes USA |

`shippingRegionForCountry` is a presentation/reporting classification only. The existing persisted `shippingZoneForCountry` values `uk`, `europe`, `rest-of-world` stay unchanged, as do the GBP flat-rate tariffs and existing shipping-rate revisions. Classifying a country does **not** make it eligible for orders: the individual destination, zone, method and rate statuses must all be eligible and approved. US is additionally rejected in checkout even if an erroneous rate is present, and guarded development/staging configuration refuses US in its explicit test allowlist.

**No blanket Rest-of-World activation.** Regional pricing is a commercial decision, not proof of a serviceable destination. Evaluate carrier acceptance of this specific mains-powered K-803 device, parcel limits, tracked service, export/customs product classification, local consumer/import restrictions, customer-paid duties/taxes disclosure and support/return obligations **per country**. Keep international import charges separate from the shipping charge. Do not promise DAP where carrier or law requires a different paid-duty arrangement.

## Remaining production implementation (not in this PR)

1. Specify and approve the initial destination ISO country allowlist, excluding US, after carrier/regulatory checks. Earlier courier research cities are candidates, **not** activated country approvals.
2. Prepare a separately reviewed, guarded **disabled-only** production international shipping setup; never run `configure-international-shipping.mjs` on production because it is explicitly non-production/test-only.
3. Update production checkout gates for live-safe UK 2–3 quantity home delivery and UK manual InPost (see production inventory/packaging audit). Review international multi-unit requirements separately; the current non-UK multi-unit guard remains fail-closed.
4. Rehearse newly affected permitted destinations in staging against Mollie **test** with representative address formats and customs acknowledgement. Reuse existing evidence where it already covers a scenario. Do not require an InPost API.
5. Activate live destinations and providers only after shipping, product compliance, fulfilment and GO/NO-GO approval.

This PR changes code classification and enforces US exclusion but does **not** create/enable production shipping rows, activate payments, or approve any new country.
