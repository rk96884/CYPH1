import assert from "node:assert/strict";
import test from "node:test";
import { quoteShipping, money, shippingZoneForCountry, calculateCarrierShipment, type CarrierTariff, type PackagingProfile, type ShippingRate } from "./index.js";
const tariff: CarrierTariff = { carrier: "royal-mail", serviceId: "synthetic-tracked", carrierZone: "synthetic-europe-3", revision: "synthetic-v1", sourceUrl: "https://example.invalid/test", retrievedAt: "2026-10-08T00:00:00Z", evidenceKind: "synthetic",
    available: true, tracked: true, maximumWeightGrams: 20000, maximumDimensions: { lengthMm: 610, widthMm: 460, heightMm: 460 }, weightBasis: "actual", fulfilmentMethod: "manual",
    includedCompensationMinor: 5000, maximumInsurableValueMinor: 100000, additionalCompensation: { coverMinor: 100000, costMinor: 310 }, customs: "dap", contentsApproved: true, restrictions: "Synthetic fixture only", eligibilityEvidenceUrl: "https://example.invalid/test" };
const packaging: PackagingProfile = { id: "synthetic", version: 1, productId: "test", fulfilmentMethod: "manual", minimumQuantity: 1, maximumQuantity: 1, additionalWeightGrams: 108, dimensions: { lengthMm: 400, widthMm: 300, heightMm: 300 }, status: "test" };
const multiPackaging: PackagingProfile = { ...packaging, id: "synthetic-multi", minimumQuantity: 2, maximumQuantity: 10, additionalWeightGrams: 150, verificationStatus: "synthetic" };
const rate = (minimum: number, maximum: number, price: number): ShippingRate => ({ id: `band-${minimum}`, version: minimum, zoneKey: "europe", countryCode: "TR", methodKey: "synthetic", methodName: "Synthetic tracked", price: money(price, "GBP"), status: "test", minimumWeightGrams: minimum, maximumWeightGrams: maximum, effectiveFrom: new Date("2026-01-01"), carrierTariff: tariff });
const shipment = (quantity = 1) => ({ productId: "test", quantity, unitWeightGrams: 953, merchandiseValueMinor: 7499 * quantity, packagingProfiles: [packaging, multiPackaging] });
const calculate = (overrides: Partial<Parameters<typeof calculateCarrierShipment>[0]> = {}) => calculateCarrierShipment({ tariff, packaging, productId: "test", quantity: 1, unitWeightGrams: 953, merchandiseValueMinor: 7499, countryCode: "TR", allowTestRates: true, ...overrides });
test("synthetic tariff quantities include packaging and full-order compensation", () => {
    for (const quantity of [1, 2, 3, 4, 5, 10]) {
        const quotes = quoteShipping({ destination: { countryCode: "TR", zoneKey: "europe", status: "test" }, rates: [rate(1, 2000, 1000), rate(2001, 20000, 2000)], basketSubtotal: money(quantity * 7499, "GBP"), totalWeightGrams: 953 * quantity, shipment: shipment(quantity), allowTestRates: true });
        assert.equal(quotes.length, 1);
        const q = quotes[0]!;
        assert.equal(q.price.value, (quantity === 1 ? 1000 : 2000) + 310);
        assert.equal(q.carrierCalculation?.actualWeightGrams, quantity === 1 ? 1061 : 953 * quantity + 150);
        assert.equal(q.carrierCalculation?.merchandiseValueMinor, 7499 * quantity);
        assert.equal(q.carrierCalculation?.tariff.carrierZone, "synthetic-europe-3");
    }
});
test("inclusive tariff band boundaries select exactly one band", () => {
    for (const [weight, id] of [[2000, "band-1"], [2001, "band-2001"]] as const) {
        const q = quoteShipping({ destination: { countryCode: "TR", zoneKey: "europe", status: "test" }, rates: [rate(1, 2000, 1000), rate(2001, 20000, 2000)], basketSubtotal: money(7499, "GBP"), totalWeightGrams: weight, shipment: { ...shipment(), unitWeightGrams: weight, packagingProfiles: [{ ...packaging, additionalWeightGrams: 0 }] }, allowTestRates: true });
        assert.equal(q[0]?.rateId, id);
    }
});
test("missing/unapproved/undersized packaging, limits, contents and availability fail closed", () => {
    for (const overrides of [{ packaging: undefined }, { packaging: { ...packaging, status: "disabled" as const } }, { quantity: 11 }, { packaging: { ...packaging, maximumQuantity: 1 }, quantity: 2 },
        { tariff: { ...tariff, maximumWeightGrams: 1000 } }, { packaging: { ...packaging, dimensions: { lengthMm: 700, widthMm: 300, heightMm: 300 } } },
        { tariff: { ...tariff, maximumDimensionSumMm: 999 } }, { tariff: { ...tariff, available: false } }, { tariff: { ...tariff, tracked: false } }, { tariff: { ...tariff, contentsApproved: false } },
        { allowTestRates: false }, { packaging: { ...packaging, productId: "different" } }, { packaging: { ...packaging, fulfilmentMethod: "other" } }])
        assert.equal(calculate(overrides), undefined);
});
test("compensation covers complete order or rejects without splitting", () => {
    const limited = { ...tariff, maximumInsurableValueMinor: 25000, additionalCompensation: { coverMinor: 25000, costMinor: 310 } };
    assert.equal(calculate({ tariff: limited, packaging: multiPackaging, quantity: 3, merchandiseValueMinor: 22497 })?.additionalCompensationMinor, 310);
    for (const value of [29996, 37495, 74990])
        assert.equal(calculate({ tariff: limited, merchandiseValueMinor: value }), undefined);
    assert.equal(calculate({ tariff: { ...tariff, additionalCompensation: undefined } }), undefined);
    assert.equal(calculate({ merchandiseValueMinor: 5000 })?.additionalCompensationMinor, 0);
});
test("customs are service-specific; US duties workflow remains unsupported", () => {
    for (const customs of ["unverified", "duties-paid", "domestic"] as const)
        assert.equal(calculate({ tariff: { ...tariff, customs } }), undefined);
    assert.equal(calculate({ countryCode: "US" }), undefined);
    for (const countryCode of ["TR", "AE", "SA"])
        assert.ok(calculate({ countryCode })); // synthetic evidence only
    assert.ok(calculate({ countryCode: "GB", tariff: { ...tariff, customs: "domestic" } }));
    assert.equal(shippingZoneForCountry("TR"), "europe");
});
test("volumetric calculation uses verified divisor and respects billable weight", () => {
    const c = calculate({ tariff: { ...tariff, weightBasis: "volumetric", volumetricDivisorCm3PerKg: 5000 } });
    assert.equal(c?.billableWeightGrams, 7200);
    assert.equal(c?.actualWeightGrams, 1061);
    assert.equal(calculate({ tariff: { ...tariff, weightBasis: "volumetric", volumetricDivisorCm3PerKg: 5000, maximumWeightGrams: 7000 } }), undefined);
});
test("country mapping and destination approval cannot be bypassed by tariff", () => {
    assert.throws(() => quoteShipping({ destination: { countryCode: "DE", zoneKey: "europe", status: "test" }, rates: [rate(1, 2000, 1000)], basketSubtotal: money(7499, "GBP"), totalWeightGrams: 953, shipment: shipment(), allowTestRates: true }));
    assert.throws(() => quoteShipping({ destination: { countryCode: "TR", zoneKey: "europe", status: "disabled" }, rates: [rate(1, 2000, 1000)], basketSubtotal: money(7499, "GBP"), totalWeightGrams: 953, shipment: shipment(), allowTestRates: true }));
});

test("provisional multi-unit allowance cannot enable checkout, even if status is approved", () => {
  for (const status of ["disabled", "test", "active"] as const) {
    assert.equal(calculate({quantity:2,packaging:{...multiPackaging,status,verificationStatus:"provisional"}}),undefined);
  }
  assert.equal(calculate({quantity:2,packaging:{...multiPackaging,additionalWeightGrams:200}})?.actualWeightGrams,2106);
  assert.equal(calculate({quantity:2,packaging:{...multiPackaging,verificationStatus:"provisional"},allowProvisionalEstimates:true})?.actualWeightGrams,2056);
});
