# Shipping commercial-validation pack

**Status:** Prepared for provider enquiries; no carrier or aggregator approved  
**Production commerce:** Disabled  
**Last engineering update:** 15 September 2026

## Purpose

Obtain comparable written evidence from Sendcloud, InPost and Evri before
CYPH/1 selects a launch shipping service. This pack does not create an account,
accept provider terms, approve expenditure or authorise an integration.

The preferred architecture remains a generic customer-facing **Locker /
Collection Point** proposition backed by a CYPH/1-owned carrier abstraction.
Sendcloud is the leading aggregator candidate, subject to validation. InPost
and Evri are candidate underlying carriers.

## Current initial-launch decision — 7 October 2026

The launch register supersedes the earlier multi-carrier/collection-point
planning for initial launch: Standard UK Delivery — £3.99, tracked to the
customer's address, additional to £74.99. Royal Mail Tracked 48 is the
preferred/default operational carrier; Evri, DPD and InPost Home Delivery are
alternatives subject to final verification. Do not promise a carrier or offer
locker/collection-point selection. Carrier API/aggregator/label automation
is a post-launch enhancement, not an initial launch dependency.

The project owner confirms K-803 is mains powered with no internal battery.
Retail box: 32 × 24 × 12 cm; known sample: under 1 kg. Final customer-ready
packed dimensions/weight, current carrier rate/service/eligibility and
compensation/claims terms still require verification and retained evidence.
£3.99 is planning-approved only; no live checkout shipping rate is configured.
SH-01/SH-02 and GO-01 remain open.

The historical candidate enquiry brief below is retained as background;
use the current launch register for product selection and planning facts.

## Product facts for enquiries

Use only the following currently confirmed description:

> CYPH/1 is preparing to launch a premium home-use IPL beauty device in the UK.
> Current product candidates are mains-powered, use an external AC/DC power
> adapter and contain no battery. The final product, packaged dimensions,
> packaged weight and retail/replacement value remain under selection.

Do not provide unapproved specifications, manufacturer identities, volume
commitments, retail price or launch dates. When a provider requires a value or
dimension to quote, mark the response provisional and repeat commercial
validation after the final product and packaging are approved.

## Evidence standard

For every material answer, record:

- provider and legal contracting entity;
- named service/product and geographic scope;
- response date and expiry/review date;
- source URL, contract clause, rate card or written provider response;
- whether the term applies to a direct contract, aggregator rate or both;
- currency and whether VAT, fuel, peak and other surcharges are included;
- assumptions about parcel dimensions, weight, value and volume;
- evidence owner and restricted evidence location; and
- unresolved qualification or contradiction.

Do not commit private contacts, credentials, quotes marked confidential,
account identifiers or signed contracts to this repository.

## Common provider questionnaire

Send the relevant provider this common set before comparing offers.

### Carriage and product acceptance

1. Will the named service accept a mains-powered IPL/electronic beauty device
   containing no battery and supplied with an external UK AC/DC adapter?
2. Are electronics, optical components, glass, quartz, lamps, capacitors or the
   external adapter prohibited, restricted or accepted only without cover?
3. Do different rules apply to home, locker, shop/PUDO and return services?
4. What packaging, labelling, dangerous-goods declaration or testing is
   required?
5. What are the maximum parcel dimensions, weight and declared/item value for
   each proposed service?
6. Please confirm acceptance in writing against the final product description
   and packaging before launch.

### Liability, compensation and insurance

1. What loss and damage compensation is included per parcel?
2. Are electronic devices or internal electrical/optical damage excluded?
3. What is the maximum accepted item value and maximum payable compensation?
4. Can cover be increased to the full retail/replacement value, and at what
   cost?
5. Does additional insurance cover theft, total loss, external damage and
   internal damage in transit?
6. What evidence, deadlines, excesses and depreciation rules apply to claims?
7. Who handles and pays the claim when service is bought through an aggregator?
8. Are outbound, return-to-sender and customer-return parcels covered equally?

An offer fails the launch gate if CYPH/1 cannot insure an eligible parcel to an
approved replacement value or explicitly accept the residual risk through the
authorised launch process.

### Services and customer experience

1. Which UK home, locker and shop/PUDO services are available to a new merchant?
2. Which nations, islands, remote postcodes or BFPO/PO Box destinations are
   excluded or surcharged?
3. What are the delivery estimates, operating days and cut-off times?
4. How long is a parcel held at each point type, and what happens when it is not
   collected?
5. Are recipient email and UK mobile number mandatory?
6. Can a customer redirect a shipment after dispatch?
7. What proof of handover, collection and delivery is available?
8. Who sends customer notifications, under whose branding, and can duplicate
   CYPH/1 messages be disabled?

### Commercial terms

1. Provide rates for each proposed service at relevant weight/dimension bands.
2. Identify VAT, fuel, energy, peak, remote-area, residential, failed-delivery,
   address-correction, relabelling, overweight/oversize, return-to-sender and
   uncollected-parcel charges.
3. State subscription, setup, pickup, label, API, support and cancellation fees.
4. State minimum weekly/monthly/annual volume and any spend commitment.
5. Explain rate-review, indexation and contract-exit terms.
6. Confirm collection eligibility, frequency, cut-offs and missed-collection
   remedies at the expected launch volume.
7. Provide separate outbound, customer-return and return-to-sender pricing.

### Technical and operational capability

1. Is there a production and sandbox API for point search, service eligibility,
   shipment creation, labels, cancellation, returns and tracking?
2. Is an accessible location picker supplied, or must CYPH/1 build one?
3. Can points be searched by postcode and coordinates and filtered by parcel
   capability, accessibility and opening availability?
4. Are point identifiers stable, and how should a selected point be revalidated
   before shipment booking?
5. Which label formats and print/QR workflows are supported?
6. Which webhook events are available, how are they authenticated, and are
   unique event IDs supplied?
7. What are the API limits, availability objectives, retry guidance, retention
   periods and incident/support escalation routes?
8. Can historical tracking, labels and audit evidence be exported if the
   contract ends?

### Privacy and security

1. Identify controller/processor roles and all relevant subprocessors.
2. Which recipient, address, location and tracking fields are mandatory?
3. Where is UK customer data hosted and transferred?
4. Provide the DPA, retention/deletion schedule and security documentation.
5. Can labels, raw webhook payloads and tracking data be deleted or minimized
   after their required retention period?
6. Describe credential scopes, rotation, webhook authentication, audit logs,
   role-based access and MFA.
7. State breach-notification and data-subject-request assistance commitments.

## Sendcloud-specific validation

Ask Sendcloud to confirm:

- the current UK plan needed for API access, service-point selection, returns,
  webhooks and use of CYPH/1's own carrier contracts;
- the exact entitlement behind InPost's statement that Sendcloud is free for
  InPost customers with no charge for InPost labels;
- whether that entitlement includes the API, checkout point picker, branded or
  unbranded notifications, tracking, returns and support;
- which current InPost UK and Evri UK delivery-to-locker/shop products are
  available at CYPH/1's expected volume;
- whether Sendcloud rates or direct carrier contracts provide the better
  carriage eligibility and compensation route;
- the source of truth when Sendcloud and carrier service conditions conflict;
- optional Sendcloud Insurance coverage and exclusions for the complete IPL
  device, internal electronic/optical damage and returns; and
- data portability and operational continuity if CYPH/1 later adds a direct
  carrier adapter or replaces Sendcloud.

Published starting points, not approved terms:

- [Sendcloud pricing](https://www.sendcloud.com/pricing/)
- [Sendcloud service-point guidance](https://support.sendcloud.com/hc/en-gb/articles/360026097951-FAQ-Service-Points)
- [Sendcloud InPost UK conditions](https://support.sendcloud.com/hc/en-us/articles/4406824881556-InPost-UK-shipping-conditions)
- [Sendcloud Evri conditions](https://support.sendcloud.com/hc/en-us/articles/360050002291-Evri-shipping-conditions)

## InPost-specific validation

Ask InPost to confirm:

- that the complete mains-powered, battery-free device and external adapter are
  accepted for Locker/Shop, home and return services;
- whether public limits on accepted value and compensation apply to the
  proposed merchant service;
- whether any electronic, optical, glass/quartz, lamp or internal-damage
  exclusion applies;
- current UK API generation, direct onboarding, minimum volume and pickup model;
- UK nation/postcode coverage, including Northern Ireland;
- availability and terms for Shop/PUDO as well as Locker delivery;
- QR/label-free customer returns and return-to-sender timing; and
- whether InPost or Sendcloud owns notifications, claims and support.

Published statements requiring contract-specific confirmation:

- InPost says, “Batteries – We cannot accept batteries, loose or inside a
  device.” This does not appear to describe the current battery-free candidates.
- Its public page states a maximum parcel size of 410 × 380 × 640 mm, a 15 kg
  maximum weight, a £500 maximum accepted item value and compensation subject
  to a £50 maximum.

Sources:

- [InPost prohibited and non-compensatory items](https://inpost.co.uk/prohibited-items)
- [InPost ecommerce delivery](https://inpost.co.uk/business/ecommerce-delivery)
- [InPost developer migration guide](https://developers.inpost-group.com/migration-guide)
- [InPost webhook integration](https://developers.inpost-group.com/webhooks-integration)

## Evri-specific validation

Ask Evri to confirm:

- that the complete battery-free IPL device and adapter are accepted for home,
  Locker, ParcelShop and return services;
- whether the public electronic-device/internal-damage exclusion applies to the
  proposed business contract;
- whether enhanced cover or separate insurance can cover the full approved
  value and internal as well as external transit damage;
- which Frequent Seller, Business or other account is available at the expected
  launch volume;
- whether recipient delivery to ParcelShop and Locker is available through the
  proposed contract, independently of merchant drop-off arrangements;
- collections, failed attempts, redirection, proof of delivery, return-to-sender
  and claims handling; and
- direct API/service-point credentials, webhook authenticity and sandbox access.

Published statements requiring contract-specific confirmation:

- Evri lists lithium batteries as prohibited but says batteries may be sent
  when included with the equipment they power; neither describes a battery-free
  device.
- Evri places examples of electronic devices in its excluded-from-compensation
  section and says internal damage to electronics is excluded.
- Evri advertises £20 cover for most eligible parcels and optional cover up to
  £999, while prohibited and non-compensation items remain uncovered.

Sources:

- [Evri prohibited and non-compensation items](https://www.evri.com/send/what-i-can-and-cannot-send)
- [Evri parcel cover](https://www.evri.com/guides/parcel-cover)
- [Evri terms and conditions](https://www.evri.com/terms-and-conditions)
- [Evri business services](https://www.evri.com/business)

## Comparison record

Complete this from dated written evidence. Use “unknown” rather than inference.

| Criterion | Sendcloud + InPost | Sendcloud + Evri | Direct InPost | Direct Evri |
| --- | --- | --- | --- | --- |
| Contract/service quoted | Pending | Pending | Pending | Pending |
| Battery-free IPL accepted | Pending | Pending | Pending | Pending |
| Adapter/components accepted | Pending | Pending | Pending | Pending |
| Full approved value covered | Pending | Pending | Pending | Pending |
| Internal damage covered | Pending | Pending | Pending | Pending |
| Packaged size/weight eligible | Await final pack | Await final pack | Await final pack | Await final pack |
| Locker/shop delivery available | Pending | Pending | Pending | Pending |
| Home/express service available | Pending | Pending | Pending | Pending |
| Customer returns | Pending | Pending | Pending | Pending |
| All-in outbound cost | Pending | Pending | Pending | Pending |
| All-in return cost | Pending | Pending | Pending | Pending |
| Minimum volume/commitment | Pending | Pending | Pending | Pending |
| Selector/API/webhooks | Pending | Pending | Pending | Pending |
| UK geographic exclusions | Pending | Pending | Pending | Pending |
| DPA/security accepted | Pending | Pending | Pending | Pending |
| Evidence expiry/review date | Pending | Pending | Pending | Pending |

## Decision gates

A launch recommendation requires all applicable items below:

- [ ] Final product and packaging facts supplied to shortlisted providers.
- [ ] Written product acceptance for every proposed outbound and return service.
- [ ] Full-value compensation/insurance decision approved.
- [ ] Rates and all material surcharges compared on the same assumptions.
- [ ] Minimum volumes, collections and contract exits are operationally viable.
- [ ] Locker/shop coverage and collection periods support the approved promise.
- [ ] API, selector, label, tracking, return and failure behaviour validated.
- [ ] DPA, subprocessors, retention and security terms approved.
- [ ] Finance, fulfilment, privacy and executive launch owners approve the choice.
- [ ] Architecture remains replaceable through the CYPH/1 carrier abstraction.

## Initial enquiry template

**Subject:** UK ecommerce delivery enquiry — mains-powered beauty device

> CYPH/1 is preparing a UK launch of a premium home-use IPL beauty device. Our
> current candidates are mains-powered, contain no battery and use an external
> AC/DC adapter. We are evaluating home and Locker/Collection Point delivery,
> tracking and returns.
>
> Please confirm which services and merchant/account route would be appropriate.
> We particularly need written clarification of product acceptance, electronics
> exclusions, maximum accepted value, loss/damage compensation or insurance,
> parcel limits, minimum volumes, collections, rates and surcharges, returns,
> location selection, labels, tracking/webhooks and data-processing terms.
>
> Final packaged dimensions, weight, approved value and forecast volume will be
> supplied before contracting. No volume or launch commitment is made by this
> enquiry.

Attach or paste the relevant questionnaire sections. Store replies in the
restricted commercial evidence location and update only the non-confidential
comparison status in this repository.



## Royal Mail tariff readiness — 8 October 2026

**Infrastructure only; no tariff activation or gate closure.** The latest
owner-confirmed measurements are: retail-packaged device **953 g**; complete
single-unit shipment **1,061 g**, correcting the earlier rounded figure.
The difference, **108 g**, is inferred single-unit protective packaging, not a
separately measured component. Single-unit dimensions remain 30 × 20 × 9 cm;
intended retail price remains £74.99.

For Royal Mail calculations, use persisted retail-packaged unit weight 953 g
with separate quantity-specific profiles: quantity 1 adds 108 g (1,061 g total);
quantities 2–10 add a **provisional, configurable 150 g** once per shipment:
`(quantity × 953) + 150`. Do not multiply the complete single-unit shipping
weight by quantity or add protective packaging twice. No catalogue/database
values are changed by this correction.

The multi-unit allowance is an estimate, not verified packed weight or carton
approval. Keep its profile disabled and marked `verificationStatus: provisional`.
Offline tariff preview may display the estimate, but checkout rejects
provisional profiles even if their status is accidentally approved. Multi-unit
checkout also rejects missing verification evidence; synthetic profiles qualify
only in guarded test mode. Actual cartons, dimensions and complete packed weights
must be verified and explicitly approved, then entered as a new immutable
profile revision marked `verified`, before multi-unit checkout can be enabled.

### Official evidence inspected

Retrieved 8 October 2026; public evidence, not an approved account quotation:

- [Current postage prices](https://www.royalmail.com/current-postage-prices)
  links the [online guide effective 5 October 2026](https://www.royalmail.com/sites/royalmail.com/files/2026-10/online-price-guide-october-2026-v1.pdf).
  This is distinct from counter/business pricing. Its UK Tracked table includes
  £75 compensation; its international tables include £50 and optional £250
  cover for £3.10. Review tax, collection and other charges separately. A
  four-unit £299.96 shipment exceeds that international cover ceiling, even
  if a heavier weight service accepts the parcel.
- [International Tracked](https://www.royalmail.com/sending/international/international-tracked)
  contains country-specific bands, not a universal starting price. Its published
  online small-parcel table distinguishes Germany, France and Türkiye. Carrier
  Europe zones must not be inferred from the site's flat commercial Europe zone.
- [International Tracked Heavier](https://www.royalmail.com/sending/international/international-tracked-signed-heavier)
  is the current heading at the older tracked-signed-heavier URL. It lists
  medium parcel limits, country-specific weight exceptions and compensation;
  a signature is not a substitute for sufficient cover. Ordinary Tracked &
  Signed is a distinct service and requires its own reviewed rules.
- [US service updates](https://www.royalmail.com/usapersonalupdates)
  describe PDDP and duties/handling calculations for goods. Current checkout
  only supports the approved customer-pays-import-charges arrangement; Royal
  Mail US tariff services are therefore rejected even if mislabelled DAP.
  A separate approved duties-paid calculation/disclosure is needed first.
- [EU trade updates](https://www.royalmail.com/europeantradeinsights)
  describe changed duties and forthcoming handling requirements. Do not assume
  historic EU customs arrangements remain valid.
- [Country guides](https://www.royalmail.com/sending/international/country-guides),
  [tracked coverage](https://www.royalmail.com/sending/international/international-tracked-signed/coverage)
  and the [incident bulletin](https://www.royalmail.com/international-incident-bulletin)
  must be rechecked before approving each country/service, especially Gulf routes.

**Remaining evidence:** reconcile the service pages with the dated tariff guide
where prices/promotions differ; retain the chosen buying-channel schedule,
exact destination bands, current availability, dimensional rules/weight basis,
contents acceptance and compensatory exclusions for the complete IPL kit,
cover eligibility and all surcharges. Turkey and UAE/Saudi DAP compatibility
has not been established for a selected service by this review: leave those
carrier tariffs disabled/unverified. Germany/France also require reviewed
current customs arrangements. No real rates are seeded by this change.

### Versioned tariff data and controlled review

The format is demonstrated by
`apps/commerce-api/fixtures/royal-mail-synthetic-tariff.json`. Every value in that
fixture, including carton dimensions, service and prices, is **synthetic, disabled
and not launch evidence**. Rates reuse existing database price/country/currency/
band/effective-date/version columns and add `carrierTariff`. The latter records
`carrier`, `serviceId`, distinct `carrierZone`, schedule `revision`, `sourceUrl`,
`retrievedAt`, `evidenceKind`, `available`, `tracked`, maximum weight/dimensions,
optional combined-dimensions limit, weight basis/divisor, `fulfilmentMethod`,
included/optional/maximum compensation, customs mode, contents approval,
restrictions and eligibility evidence URL. Official sources must use Royal Mail
HTTPS URLs. Synthetic evidence cannot qualify outside the guarded test mode.

`packagingProfiles` records product ID, profile ID/version, fulfilment method,
minimum/maximum quantity, additional weight, outer dimensions and disabled
status. Approval is separate from evidence. Different physical cartons require
different immutable revisions; do not approve overlapping quantity profiles.

1. Obtain a complete dated official schedule and service eligibility evidence.
   Record review/approval in the existing launch evidence register. No scraper
   or automatic update is installed.
2. Enter new UUID rate IDs and new integer versions for every band. All rows
   share the reviewed schedule revision; per-country/method integer versions
   must be unique, including different bands. Never overwrite an earlier row.
   Map explicit ISO countries to their existing commercial zone and reviewed
   carrier zone. No country creation/approval is performed by the importer.
3. Build runtime, then preview offline from the repository root:

   ```powershell
   npm run build:runtime --workspace @cyph1/commerce-api
   $env:TARIFF_PREVIEW_PRODUCT_ID='00000000-0000-4000-8000-000000000001'
   node apps/commerce-api/scripts/review-royal-mail-tariff.mjs apps/commerce-api/fixtures/royal-mail-synthetic-tariff.json apps/commerce-api/fixtures/royal-mail-synthetic-tariff.json
   ```

   Replace the two file arguments with retained previous/candidate schedules
   for a real review. The output shows price/weight-band changes and estimates
   for quantities 1, 2, 3, 4, 5 and 10 per supplied country. Preview uses reference
   weight/value and candidate profiles in memory; it grants no approval. Deleted bands are reported explicitly against the retained previous schedule.
4. Optional `--import-disabled` requires all four gates explicitly `false`:
   `COMMERCE_ENABLED`, `CHECKOUT_HTTP_ENABLED`, `PAYMENT_WEBHOOKS_ENABLED`,
   `PRIVATE_CHECKOUT_FIXTURE_ENABLED`; `PAYMENT_PROVIDER=mollie-test`;
   `TARIFF_IMPORT_APPROVED_REVISION` equal to the exact candidate revision;
   a test/staging-named database whose name exactly matches
   `CONFIRM_NON_PRODUCTION_DATABASE`, and configured TLS where required.
   Existing country/zone/method names must match. Import is atomic, inserts
   only disabled rates/profiles, and changes no existing records. UUID/version
   collisions roll back the whole import. No credentials belong in JSON/Git.
5. Activation is deliberately a separate, explicitly authorised database
   operation, not an importer flag. Review all relevant rates/profiles and
   destination/method/zone approvals, then in a transaction retire old IDs by
   setting status disabled and approve only exact reviewed IDs/versions to
   test (staging) or active (separately authorised launch). Never mass-approve
   all Royal Mail rows or implicitly approve a country. Keep live gates disabled.
   Requote all supported quantities and verify snapshots before any approved
   sandbox rehearsal. Activation does not close SH-01, SH-02, PAY-01 or GO-01.

### Synthetic examples only

Fixture preview uses the confirmed 953 g retail-packaged unit weight, inferred
108 g single-unit protection and **provisional** 150 g multi-unit protection.
The 400 × 300 × 300 mm example carton remains **invented**, not approved.
The **invented** rates are £10 up to 2 kg and £20 above 2 kg up to 20 kg, with
£3.10 optional cover to £250. These are estimates, not carrier quotations or
checkout approval; both profiles remain disabled:

| Qty | Merchandise | Calculated weight | Preview result |
| --- | --- | --- | --- |
| 1 | £74.99 | 1,061 g (measured total) | £13.10 shipping |
| 2 | £149.98 | 2,056 g (estimate) | £23.10 shipping |
| 3 | £224.97 | 3,009 g (estimate) | £23.10 shipping |
| 4 | £299.96 | 3,962 g (estimate) | Ineligible: insufficient cover |
| 5 | £374.95 | 4,915 g (estimate) | Ineligible: insufficient cover |
| 10 | £749.90 | 9,680 g (estimate) | Ineligible: insufficient cover |

Tests additionally use explicitly synthetic £1,000 maximum cover to exercise
all quantities using synthetic approved packaging, without claiming such cover is offered by Royal Mail. Shipping
is additional to merchandise; the full total is recalculated server-side.

### Safe deployment, audit and rollback

Obtain deployment approval first. Backup/verify the named staging database;
keep all customer/fixture/webhook/commerce gates disabled. Apply migration 0018
then additive 0019 before deploying the dependent runtime. Verify new columns,
packaging table and immutability triggers. No migration seeds prices, packaging,
country approvals, live configuration or historical snapshots. Test locally
with `test-shipping-snapshots.mjs` only against its disposable loopback database.

On staging, preview/import only reviewed disabled data. Approve exact test rows
separately and rehearse only when authorised. Preserve disabled baseline after
rehearsal. Runtime rollback may retain the additive schema; disable new carrier
rates first. Configuration rollback may reapprove an earlier immutable revision
only if still effective, eligible and currently approved, retiring the successor
in the same transaction. Never edit/delete historical orders or snapshots,
remove immutability triggers, or revive expired/restricted services. Existing
single-unit flat staging rates remain available only when no carrier rows are
approved; multi-unit quantities require approved packaging and carrier rates.
Operations staff inspect protected order detail shipping evidence to compare
applied postage, cover charge, tariff source/revision and carton inputs, without
recalculating the historical order. All launch gates remain unchanged.


### Implementation validation — 8 October 2026

Local only: 24 commerce-core tests and 302 commerce-API tests passed, with no
skips when using disposable loopback PostgreSQL. The separate shipping
snapshot script passed migrations, tariff import atomicity, pricing/evidence
immutability, all six quantities, cover charges, historical reads, stale quotes,
idempotent replay, payment failures and packaging-approval race rollback.
The local cluster was shut down afterward. No hosted payments, labels or
shipments were created; no staging/production database was accessed.

Astro/TypeScript check (zero errors/warnings; one existing operations async
hint), site/runtime builds, 11 product tests, 6 route-gate tests, dependency
policy/security audits, link/structural accessibility audits (public and private
fixtures), performance budget, operations UI tests, staging monitor/load
safeguard tests and restore-verifier tests passed. Private build flags were
process-local; default site output was rebuilt afterward. Diff whitespace checks
passed. No website markup/styles, dependencies, live configuration or gate
statuses changed. Royal Mail infrastructure remains pending review/deployment.
