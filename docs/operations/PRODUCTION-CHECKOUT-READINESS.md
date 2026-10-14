# Production checkout readiness — code preparation only

**This change is not a launch approval and does not activate commerce.** Production shipping zones, countries, methods and rates prepared on 14 October 2026 remain `disabled`.

## Code preparation
- UK home delivery maps one unit to the GB tracked-postage revision 1 (£3.99), and two or three units to revision 2 (£7.99).
- UK manual InPost maps one or two units to revision 1 (£2.59 Medium), and three units to revision 2 (£3.99 Large).
- Both UK delivery methods use the standard shipping eligibility checks. Only independently `active` destination/method/rate records can be used outside private test mode. Wrong version, country, cost, status and expired rates fail closed.
- International tracked flat postage remains £14.99 for Europe and £25.99 elsewhere for **one unit only**, subject to individual country approval and active shipping records. Multiple international devices still require separately approved carrier/packaging configuration.
- USA remains excluded even if a shipping record were accidentally inserted.
- InPost remains UK only, with explicit collection-point and UK mobile validation and manual booking. No InPost API, point picker, payment activation or email/dispatch activation is introduced.

## Outstanding prerequisites before any live checkout
- Product-specific K-803 compliance; launch GO/NO-GO and owner signoff.
- Royal Mail and InPost physical packed dimensions, weight/parcel acceptance, insurance or compensation for aggregate contents, and manual InPost point booking/tracking/dispatch rehearsal.
- International country-by-country carrier suitability, import compliance and destination-specific tax/customs terms; enable countries individually, never by blanket zone.
- Explicit separate review of commercial launch flags, live payment integration, operational workflow and shipping status changes. Do not enable these simply because CI passes.

## Verification
Automated tests use in-memory synthetic fixtures to verify 1–3 UK quantities, disabled-by-default rejection in simulated live mode, quantity-specific approved revisions, US blocking and unapproved international multi-unit blocking. They do not contact Render, alter production data, use a live gateway or place orders.

The 14 October 2026 production inspector output established 3 disabled zones, 32 disabled destinations (GB plus 31 international), 35 disabled rates (4 GB plus 31 international) and zero packaging profiles. This PR does not change that data.
