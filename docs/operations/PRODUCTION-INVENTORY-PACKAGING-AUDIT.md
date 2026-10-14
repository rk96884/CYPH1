# Production K-803 inventory and packaging code audit

**14 October 2026 — read-only repository review; NOT approval to enable live commerce.**

## Established facts

- The approved initial plan is approximately **20 K-803 devices, with 1 reserved for replacements**, so **19 potentially sellable** after receipt/acceptance. This is a plan, **not evidence that 20 units were received or inventory rows exist in production**.
- Maximum checkout quantity is **3**. Approved UK per-order charges are home £3.99/£7.99/£7.99 (1/2/3) and manual InPost collection £2.59/£2.59/£3.99 (1/2/3).
- On 13 October production contained four **disabled** quantity-based shipping rate rows, two disabled methods, UK/GB disabled, and **zero** `shipping_packaging_profiles`. No current production inventory contents have been verified.
- `checkout/postgres.ts::getProduct` computes sellable quantity as `SUM(available_quantity - reserved_quantity - safety_stock)` and clamps the result at zero. A dedicated `safety_stock=1` on a verified single 20-unit inventory location would reserve one device from new checkout availability **only once actual accepted stock is recorded**. Confirm inventory location ownership and existing safety stock before assigning values; never create placeholder stock.
- `checkout/service.ts` loads packaging profiles only when it sees `carrierTariff` shipping rates. Flat per-order UK price rows have no `carrier_tariff` and the checkout quote for these does not require `shipping_packaging_profiles`; therefore **an empty packaging table is not itself a blocker for the chosen flat-price/manual-carrier model**. Physical packing, carrier suitability and compensation still need external evidence.

## Actual checkout launch blockers found

1. `checkout/service.ts` currently refuses InPost collection when `!testShippingAllowed`. The production decision is manual InPost Send, not an InPost API; production-safe InPost enablement needs a narrowly reviewed code change after business approvals, preserving the point-verification and no-substitution safeguards.
2. `checkout/service.ts` permits 2–3 unit flat-rate UK home delivery only through `ukHomeMulti` gated on `testShippingAllowed`. Without an approved carrier tariff and packaging profile, live 2–3 unit home quotations will fail closed. A separate change is required to support the **already approved 1–3 pricing**, with explicit production readiness checks and disabled-by-default activation; this is not a request to repeat staging quote tests.
3. Four shipping rates and their methods/destination remain **disabled** on production. Enabling them is a separate controlled, owner-authorised data change, not part of this code audit.
4. Product inventory/accepted stock, final product price and status, unit shipping weight, and inventory reservation configuration have **not yet been inspected against production records**. Do not infer stock from the 20-unit procurement plan.
5. Carrier/packaging physical eligibility, compensation-risk signoff, K-803 model-specific compliance and launch GO/NO-GO remain separate blockers.

## Recommended implementation path — requires separate approval

- Record physical receipt/acceptance and location-level inventory with a read-only inspection first; confirm `safety_stock` supports the one-unit replacement reserve, without altering stock in this audit.
- Create a separately reviewed checkout code PR for **live-safe** UK flat-rate 1–3 home and manual InPost methods. Preserve all default-off production gates, 3-unit limit, version-specific rate selection, snapshot/price checks, approved point workflow, and no international methods. Add positive and fail-closed tests for 1–3 quantities, disabled shipping, inactive product, insufficient net inventory and non-GB destination. Do not introduce InPost API integration or carrier tariff profiles merely to make flat pricing work.
- After code passes CI, keep production disabled pending physical compliance, supplier/carrier confirmation, operational capacity and explicitly approved activation. Any production inventory write or shipping status change must be a separate guarded approval and audited action.

See [PRODUCTION-UK-SHIPPING-SETUP.md](PRODUCTION-UK-SHIPPING-SETUP.md), [PRODUCTION-FULFILMENT-REHEARSAL-PLAN.md](PRODUCTION-FULFILMENT-REHEARSAL-PLAN.md), and [COMMERCE-LAUNCH-READINESS.md](COMMERCE-LAUNCH-READINESS.md).
