import { CommerceDomainError } from "./errors.js";
export type ParcelDimensions = Readonly<{
    lengthMm: number;
    widthMm: number;
    heightMm: number;
}>;
export type PackagingProfile = Readonly<{
    id: string;
    version: number;
    productId: string;
    fulfilmentMethod: string;
    minimumQuantity: number;
    maximumQuantity: number;
    additionalWeightGrams: number;
    verificationStatus?: "verified" | "provisional" | "synthetic";
    dimensions: ParcelDimensions;
    status: "disabled" | "test" | "active";
}>;
export type CarrierTariff = Readonly<{
    carrier: "royal-mail";
    serviceId: string;
    carrierZone: string;
    revision: string;
    sourceUrl: string;
    retrievedAt: string;
    evidenceKind: "official" | "synthetic";
    available: boolean;
    tracked: boolean;
    maximumWeightGrams: number;
    maximumDimensions: ParcelDimensions;
    maximumDimensionSumMm?: number;
    weightBasis: "actual" | "volumetric";
    volumetricDivisorCm3PerKg?: number;
    fulfilmentMethod: string;
    includedCompensationMinor: number;
    maximumInsurableValueMinor: number;
    additionalCompensation?: Readonly<{
        coverMinor: number;
        costMinor: number;
    }> | undefined;
    customs: "domestic" | "dap" | "duties-paid" | "unverified";
    contentsApproved: boolean;
    restrictions: string;
    eligibilityEvidenceUrl: string;
}>;
export type CarrierCalculation = Readonly<{
    tariff: CarrierTariff;
    packaging: PackagingProfile;
    actualWeightGrams: number;
    billableWeightGrams: number;
    merchandiseValueMinor: number;
    compensationLimitMinor: number;
    additionalCompensationMinor: number;
}>;
const integer = (n: number, minimum = 0) => Number.isSafeInteger(n) && n >= minimum;
const dimensionsValid = (d: ParcelDimensions) => d && [d.lengthMm, d.widthMm, d.heightMm].every(n => integer(n, 1));
export const validatePackaging = (p: PackagingProfile): void => {
    if (!p.id || !p.productId || !p.fulfilmentMethod || !integer(p.version, 1) || !integer(p.minimumQuantity, 1)
        || !integer(p.maximumQuantity, p.minimumQuantity) || p.maximumQuantity > 10 || !integer(p.additionalWeightGrams)
        || (p.verificationStatus !== undefined && !["verified", "provisional", "synthetic"].includes(p.verificationStatus))
        || !dimensionsValid(p.dimensions) || !["disabled", "test", "active"].includes(p.status))
        throw new CommerceDomainError("invalid_packaging", "Invalid packaging profile.");
};
export const validateCarrierTariff = (t: CarrierTariff): void => {
    const official = (value: string) => { try {
        const u = new URL(value);
        return u.protocol === "https:" && (u.hostname === "royalmail.com" || u.hostname.endsWith(".royalmail.com"));
    }
    catch {
        return false;
    } };
    if (!t || t.carrier !== "royal-mail" || !t.serviceId || !t.carrierZone || !t.revision || !t.fulfilmentMethod
        || !["official", "synthetic"].includes(t.evidenceKind) || !Number.isFinite(Date.parse(t.retrievedAt))
        || !t.sourceUrl || !t.eligibilityEvidenceUrl || (t.evidenceKind === "official" && (!official(t.sourceUrl) || !official(t.eligibilityEvidenceUrl)))
        || !integer(t.maximumWeightGrams, 1) || !dimensionsValid(t.maximumDimensions)
        || (t.maximumDimensionSumMm !== undefined && !integer(t.maximumDimensionSumMm, 1))
        || !["actual", "volumetric"].includes(t.weightBasis)
        || (t.weightBasis === "volumetric" && !integer(t.volumetricDivisorCm3PerKg!, 1))
        || !integer(t.includedCompensationMinor) || !integer(t.maximumInsurableValueMinor, t.includedCompensationMinor)
        || (t.additionalCompensation && (!integer(t.additionalCompensation.coverMinor, t.includedCompensationMinor) || !integer(t.additionalCompensation.costMinor)
            || t.additionalCompensation.coverMinor > t.maximumInsurableValueMinor))
        || !["domestic", "dap", "duties-paid", "unverified"].includes(t.customs) || !t.restrictions
        || [t.available, t.tracked, t.contentsApproved].some(v => typeof v !== "boolean"))
        throw new CommerceDomainError("invalid_carrier_tariff", "Incomplete or invalid carrier tariff evidence.");
};
/** No implicit parcel splitting or assumptions about carton size or cover. */
export const calculateCarrierShipment = (input: Readonly<{
    tariff: CarrierTariff;
    packaging?: PackagingProfile | undefined;
    productId: string;
    quantity: number;
    unitWeightGrams: number;
    merchandiseValueMinor: number;
    countryCode: string;
    allowTestRates: boolean;
    allowProvisionalEstimates?: boolean;
}>): CarrierCalculation | undefined => {
    const t = input.tariff;
    validateCarrierTariff(t);
    const p = input.packaging;
    if (!p)
        return undefined;
    validatePackaging(p);
    // Provisional cartons are calculation estimates only, never checkout approvals.
    if (p.verificationStatus === "provisional" && !input.allowProvisionalEstimates) return undefined;
    if (p.verificationStatus === "synthetic" && !input.allowTestRates) return undefined;
    if (input.quantity > 1 && p.verificationStatus !== "verified"
        && !(p.verificationStatus === "synthetic" && input.allowTestRates)
        && !input.allowProvisionalEstimates) return undefined;
    if (!integer(input.quantity, 1) || input.quantity > 10 || !integer(input.unitWeightGrams, 1) || !integer(input.merchandiseValueMinor, 1))
        return undefined;
    if (!t.available || !t.tracked || !t.contentsApproved || (t.evidenceKind === "synthetic" && !input.allowTestRates)
        || p.productId !== input.productId || p.fulfilmentMethod !== t.fulfilmentMethod
        || !(p.status === "active" || (input.allowTestRates && p.status === "test"))
        || input.quantity < p.minimumQuantity || input.quantity > p.maximumQuantity
        || input.countryCode === "US"
        || (input.countryCode === "GB" ? t.customs !== "domestic" : t.customs !== "dap"))
        return undefined;
    // Duties-paid services require a separate approved duties calculation; this checkout supports DAP only.
    const actualWeightGrams = input.unitWeightGrams * input.quantity + p.additionalWeightGrams;
    const d = p.dimensions;
    const sides = [d.lengthMm, d.widthMm, d.heightMm].sort((a, b) => b - a);
    const limits = [t.maximumDimensions.lengthMm, t.maximumDimensions.widthMm, t.maximumDimensions.heightMm].sort((a, b) => b - a);
    if (sides.some((v, i) => v > limits[i]!) || (t.maximumDimensionSumMm && sides.reduce((a, b) => a + b, 0) > t.maximumDimensionSumMm))
        return undefined;
    const volumetric = t.weightBasis === "volumetric" ? Math.ceil(d.lengthMm * d.widthMm * d.heightMm / t.volumetricDivisorCm3PerKg!) : 0;
    const billableWeightGrams = Math.max(actualWeightGrams, volumetric);
    if (!integer(billableWeightGrams, 1) || billableWeightGrams > t.maximumWeightGrams || input.merchandiseValueMinor > t.maximumInsurableValueMinor)
        return undefined;
    let compensationLimitMinor = t.includedCompensationMinor;
    let additionalCompensationMinor = 0;
    if (input.merchandiseValueMinor > compensationLimitMinor) {
        if (!t.additionalCompensation || t.additionalCompensation.coverMinor < input.merchandiseValueMinor)
            return undefined;
        compensationLimitMinor = t.additionalCompensation.coverMinor;
        additionalCompensationMinor = t.additionalCompensation.costMinor;
    }
    return Object.freeze({ tariff: t, packaging: p, actualWeightGrams, billableWeightGrams, merchandiseValueMinor: input.merchandiseValueMinor, compensationLimitMinor, additionalCompensationMinor });
};
