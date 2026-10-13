# Disabled-only production UK shipping configuration

**Preparation only — does not approve shipping or activate live checkout.**

Owner-approved quantity pricing, as documented in `COMMERCE-LAUNCH-READINESS.md` (10 October 2026):

| Quantity | UK tracked home | Manual InPost locker/shop |
| --- | --- | --- |
| 1 | £3.99 | £2.59 Medium |
| 2 | £7.99 | £2.59 Medium |
| 3 | £7.99 | £3.99 Large |

Server checkout quantity maximum is 3. The four physical rate rows reuse the existing method keys `tracked-postage-packing` and `inpost-locker-shop` with revision 1 and 2, as tested in staging. Quantity selection remains **application logic**, not a weight-range deduction by this setup tool.

## What this script does

`apps/commerce-api/scripts/prepare-production-uk-shipping.mjs` prints a plan with no database access when invoked without flags. An explicit, owner-authorised `--apply` can insert the UK zone, GB destination, two methods, and four GBP rate revisions, **all with status disabled**. It never creates packaging profiles, enables international destinations, changes checkout flags or migrates tables.

Application requires: exact named production DB `cyph1_commerce_production`, `NODE_ENV=production`, `SHIPPING_PRODUCTION_CONFIRM=create-disabled-uk-only`, and explicit disabled commerce, checkout, webhook, payment and fulfilment environment gates. The script refuses any pre-existing shipping records other than precisely the four expected disabled rates and supporting UK rows. Repeating it against that exact configuration is a no-op. It executes under a single locked transaction and rolls back on error. If unrelated shipping rows appear, do not bypass its guard: investigate and prepare a reviewed migration.

## Operator procedure — not executed by CI or deploy

1. Review the proposed PR and secure a current backup and restore point. Ensure rotated database credentials are reflected in both production Render services and `/ready` is healthy.
2. Inspect production read-only using `inspect-production-shipping.mjs`; require an empty configuration and verify the target identity.
3. From a trusted operator machine, preview safely: `node apps/commerce-api/scripts/prepare-production-uk-shipping.mjs`.
4. After explicit approval to create **disabled** records, set the required process-only environment guards and private `DATABASE_URL` and `DATABASE_SSL` values, and run `node apps/commerce-api/scripts/prepare-production-uk-shipping.mjs --apply`. Do not place secrets in command line arguments, logs, chat or repository.
5. Remove process-only credentials and flags. Run the read-only inspection again and confirm exactly UK/GB, two disabled methods, four disabled rates (£3.99, £7.99, £2.59, £3.99), and no activated destination or packaging profiles.

## Outstanding launch gates

Hosted staging quotes, quantity-limit rejection, three-device test payments and order persistence have already been verified. **Do not repeat these by default.** Physical packed 2–3 unit dimensions/weights, Royal Mail aggregate-value compensation, InPost Medium/Large parcel acceptance and manual point booking/tracking/dispatch rehearsal, product compliance and GO/NO-GO remain separate. No InPost API is required for initial launch. Status must stay disabled until a separately authorised activation and verified physical fulfilment readiness.

## Production execution evidence — 13 October 2026

**COMPLETED — disabled records only.** Owner ran the preview and the guarded `--apply` operation against production, then ran the read-only shipping inspector. The owner-provided inspector JSON at **2026-10-13T19:09:58.700Z** confirms the following actual production state:

- One zone: `uk` / United Kingdom — **disabled**.
- One destination: `GB` — **disabled**.
- Two shipping methods: `tracked-postage-packing` and `inpost-locker-shop` — both **disabled**.
- Four GBP/GB rate rows — all **disabled**, effective from `2026-10-13T19:09:31.120Z`:
  - `tracked-postage-packing`: version 1 **399p** (one device); version 2 **799p** (two or three devices).
  - `inpost-locker-shop`: version 1 **259p** (one or two devices, Medium); version 2 **399p** (three devices, Large).
- `shipping_packaging_profiles`: **zero rows**.
- No international destination rows were present.

The inspector output confirms **persisted records**, not carrier/physical-package suitability or fulfilment authority. Manual InPost Send booking remains the agreed launch implementation; an InPost API integration is **not** required.

Before the write, the owner confirmed customer and operations `/ready` responses were healthy and reported a production database backup from **12 October 2026**; recovery/restore verification of that particular backup was **not** established by this exercise. A production DB credential was rotated earlier that day. Avoid retaining or publishing its connection string or password.

The earlier setup instructions above are kept as a repeatable reference and are **not a request to run the script again**. Do not activate these rows until separately approved; shipping readiness, physical packing, compensation, manual booking/tracking, product compliance, and overall launch GO/NO-GO remain open.
