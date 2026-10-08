import { createHash } from "node:crypto";
import type pg from "pg";
import { quoteShipping, money, normaliseCountryCode, shippingZoneForCountry, validateCarrierTariff, validatePackaging, type ShippingRate, type PackagingProfile } from "../../../../packages/commerce-core/src/index.js";
import { shippingRateRevision } from "./service.js";
export type TariffSchedule = Readonly<{
    revision: string;
    rates: readonly ShippingRate[];
    packagingProfiles: readonly PackagingProfile[];
}>;
/** JSON input uses ISO timestamps and a Money object; normalize once before validation or hashing. */
export const parseTariffSchedule = (raw: unknown): TariffSchedule => {
    const schedule = raw as Omit<TariffSchedule, "rates"> & { rates: readonly (ShippingRate & { countryCodes?: readonly string[] })[] };
    if (!schedule?.revision || !Array.isArray(schedule.rates) || !schedule.rates.length || !Array.isArray(schedule.packagingProfiles))
        throw new Error("Incomplete tariff schedule");
    // A published carrier-zone band is stored once; only import expands its ISO destinations.
    const rates = schedule.rates.flatMap(input => {
        const { countryCodes, ...rate } = input;
        if (countryCodes !== undefined && (!Array.isArray(countryCodes) || !countryCodes.length || rate.countryCode !== undefined
            || new Set(countryCodes).size !== countryCodes.length)) throw new Error("Invalid grouped tariff destinations");
        return (countryCodes ?? [rate.countryCode]).map((countryCode: string | undefined) => {
            if (!countryCode || normaliseCountryCode(countryCode) !== countryCode) throw new Error("Invalid tariff destination");
            const hex = createHash("sha256").update(`${rate.id}:${countryCode}`).digest("hex").slice(0, 32);
            const id = countryCodes ? `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}` : rate.id;
            return { ...rate, id, countryCode, effectiveFrom: new Date(rate.effectiveFrom), ...(rate.effectiveTo ? { effectiveTo: new Date(rate.effectiveTo) } : {}) };
        });
    });
    const ids = new Set<string>();
    for (const r of rates) {
        if (!r.carrierTariff)
            throw new Error("Carrier evidence is required");
        validateCarrierTariff(r.carrierTariff);
        if (!r.id || ids.has(r.id) || !Number.isSafeInteger(r.version) || r.version! < 1 || r.status !== "disabled"
            || !r.countryCode || normaliseCountryCode(r.countryCode) !== r.countryCode || shippingZoneForCountry(r.countryCode) !== r.zoneKey
            || !r.methodKey || !r.methodName || r.carrierTariff.revision !== schedule.revision
            || r.price.currency !== "GBP" || !Number.isSafeInteger(r.price.value) || r.price.value < 0
            || !Number.isSafeInteger(r.minimumWeightGrams) || r.minimumWeightGrams! < 1
            || !Number.isSafeInteger(r.maximumWeightGrams) || r.maximumWeightGrams! < r.minimumWeightGrams!
            || r.minimumSubtotal !== undefined || r.maximumSubtotal !== undefined
            || r.maximumWeightGrams! > r.carrierTariff.maximumWeightGrams || r.freeShippingThreshold !== undefined
            || !Number.isFinite(r.effectiveFrom.getTime()) || (r.effectiveTo && (!Number.isFinite(r.effectiveTo.getTime()) || r.effectiveTo <= r.effectiveFrom)))
            throw new Error("Invalid disabled tariff row");
        ids.add(r.id);
    }
    for (const r of rates)
        for (const other of rates) {
            if (r.id !== other.id && r.countryCode === other.countryCode && r.methodKey === other.methodKey
                && r.minimumWeightGrams! <= other.maximumWeightGrams! && other.minimumWeightGrams! <= r.maximumWeightGrams!)
                throw new Error("Overlapping tariff bands");
            if (r.id !== other.id && r.countryCode === other.countryCode && r.methodKey === other.methodKey && r.version === other.version)
                throw new Error("Duplicate rate version");
        }
    const profiles = new Set<string>();
    for (const p of schedule.packagingProfiles) {
        validatePackaging(p);
        const key = p.id + ":" + p.version;
        if (p.status !== "disabled" || profiles.has(key))
            throw new Error("Packaging import must be disabled and versioned");
        profiles.add(key);
    }
    return { revision: schedule.revision, rates, packagingProfiles: schedule.packagingProfiles };
};
export const tariffChanges = (previous: TariffSchedule, next: TariffSchedule) => [...next.rates.map(rate => {
    const old = previous.rates.find(r => r.countryCode === rate.countryCode && r.methodKey === rate.methodKey && r.minimumWeightGrams === rate.minimumWeightGrams);
    return { countryCode: rate.countryCode, method: rate.methodKey, minimumWeightGrams: rate.minimumWeightGrams, maximumWeightGrams: rate.maximumWeightGrams,
        previousMaximumWeightGrams: old?.maximumWeightGrams ?? null, previousPriceMinor: old?.price.value ?? null, priceMinor: rate.price.value,
        changed: !old || shippingRateRevision(old) !== shippingRateRevision(rate), removed: false };
}), ...previous.rates.filter(old => !next.rates.some(rate => rate.countryCode===old.countryCode && rate.methodKey===old.methodKey && rate.minimumWeightGrams===old.minimumWeightGrams))
 .map(old => ({countryCode:old.countryCode,method:old.methodKey,minimumWeightGrams:old.minimumWeightGrams,maximumWeightGrams:old.maximumWeightGrams,previousMaximumWeightGrams:old.maximumWeightGrams,previousPriceMinor:old.price.value,priceMinor:null,changed:true,removed:true}))];
/** Preview treats disabled candidates as test-approved only in memory, never changes database gates. */
export const previewTariff = (schedule: TariffSchedule, productId: string, unitWeightGrams: number, unitValueMinor: number, at: Date) => [...new Set(schedule.rates.map(r => r.countryCode!))].flatMap(countryCode => [1, 2, 3, 4, 5, 10].map(quantity => {
    try {
        const quotes = quoteShipping({ destination: { countryCode, zoneKey: shippingZoneForCountry(countryCode), status: "test" },
            rates: schedule.rates.map(r => ({ ...r, status: "test" })), basketSubtotal: money(unitValueMinor * quantity, "GBP"), totalWeightGrams: unitWeightGrams * quantity, at, allowTestRates: true,
            shipment: { productId, quantity, unitWeightGrams, allowProvisionalEstimates: true, merchandiseValueMinor: unitValueMinor * quantity, packagingProfiles: schedule.packagingProfiles.map(p => ({ ...p, status: "test" })) } });
        const quote = [...quotes].sort((a, b) => a.price.value - b.price.value || a.rateId.localeCompare(b.rateId))[0]!;
        return { countryCode, quantity, eligible: true, provisional: quote.carrierCalculation?.packaging.verificationStatus === "provisional", shippingMinor: quote.price.value, rateId: quote.rateId, calculation: quote.carrierCalculation };
    }
    catch {
        return { countryCode, quantity, eligible: false };
    }
}));
/** Inserts only disabled rows. No country/method/zone creation or approval, no upsert of pricing. */
export const importDisabledTariff = async (client: pg.PoolClient, schedule: TariffSchedule): Promise<void> => {
    schedule = parseTariffSchedule(schedule);
    await client.query("BEGIN");
    try {
        for (const r of schedule.rates) {
            const references = await client.query(`SELECT z.id AS zone_id,m.id AS method_id FROM shipping_zones z
        JOIN shipping_zone_countries c ON c.zone_id=z.id JOIN shipping_methods m ON m.method_key=$2
        WHERE z.zone_key=$1 AND c.country_code=$3 AND m.name=$4 FOR SHARE OF z,c,m`, [r.zoneKey, r.methodKey, r.countryCode, r.methodName]);
            if (references.rowCount !== 1)
                throw new Error("Existing destination and named service must match reviewed import");
            await client.query(`INSERT INTO shipping_rates(id,zone_id,shipping_method_id,country_code,rate_minor,currency,status,version,
        minimum_weight_grams,maximum_weight_grams,effective_from,effective_to,carrier_tariff)
        VALUES($1,$2,$3,$4,$5,'GBP','disabled',$6,$7,$8,$9,$10,$11::jsonb)`, [r.id, references.rows[0].zone_id, references.rows[0].method_id, r.countryCode, r.price.value, r.version,
                r.minimumWeightGrams, r.maximumWeightGrams, r.effectiveFrom, r.effectiveTo ?? null, JSON.stringify(r.carrierTariff)]);
        }
        for (const p of schedule.packagingProfiles)
            await client.query(`INSERT INTO shipping_packaging_profiles(id,version,product_id,status,profile) VALUES($1,$2,$3,'disabled',$4::jsonb)`, [p.id, p.version, p.productId, JSON.stringify(p)]);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
};

/** CLI guard is testable without contacting a database or reading credentials from disk. */
export const validateTariffImportEnvironment = (env: Readonly<Record<string,string|undefined>>, revision: string): void => {
 if(env.NODE_ENV === "production" || ["COMMERCE_ENABLED","CHECKOUT_HTTP_ENABLED","PAYMENT_WEBHOOKS_ENABLED","PRIVATE_CHECKOUT_FIXTURE_ENABLED"].some(key=>env[key]!=="false")
   || env.PAYMENT_PROVIDER!=="mollie-test" || env.TARIFF_IMPORT_APPROVED_REVISION!==revision) throw new Error("Disabled test gates and explicit revision approval required");
 const u=new URL(env.DATABASE_URL ?? "postgres://invalid/invalid");const name=decodeURIComponent(u.pathname.slice(1));
 if(!["postgres:","postgresql:"].includes(u.protocol) || !u.hostname || env.CONFIRM_NON_PRODUCTION_DATABASE!==name || !/(test|staging)/i.test(name) || /prod/i.test(name)) throw new Error("Named non-production database confirmation required");
};

/** Offline weight-band lookup only: deliberately does not grant service/checkout eligibility. */
export const comparePublishedPostage = (schedule: TariffSchedule, packaging = {
    unitWeightGrams: 953, singleUnitProtectionGrams: 108, multiUnitProtectionGrams: 150,
}) => {
    if (Object.values(packaging).some(value => !Number.isSafeInteger(value) || value < 0) || packaging.unitWeightGrams === 0)
        throw new Error("Invalid comparison weight inputs");
    const combinations = [...new Set(schedule.rates.map(rate => `${rate.countryCode}:${rate.methodKey}`))].sort();
    return combinations.flatMap(key => Array.from({length:10}, (_, index) => {
        const quantity = index + 1;
        const [countryCode, methodKey] = key.split(":");
        const weightGrams = quantity * packaging.unitWeightGrams + (quantity === 1 ? packaging.singleUnitProtectionGrams : packaging.multiUnitProtectionGrams);
        const candidates = schedule.rates.filter(rate => rate.countryCode === countryCode && rate.methodKey === methodKey
            && weightGrams >= rate.minimumWeightGrams! && weightGrams <= rate.maximumWeightGrams!);
        if (candidates.length > 1) throw new Error("Ambiguous published comparison band");
        const rate = candidates[0]; const tariff = rate?.carrierTariff;
        const merchandiseMinor = quantity * 7499;
        const included = tariff && merchandiseMinor <= tariff.includedCompensationMinor;
        const optional = tariff?.additionalCompensation && merchandiseMinor <= tariff.additionalCompensation.coverMinor;
        return { countryCode, methodKey, quantity, weightGrams, weightEvidence: quantity === 1 ? "measured-total" : "provisional-packaging",
            basePostageMinor: rate?.price.value ?? null, currency: "GBP", maximumBandGrams: rate?.maximumWeightGrams ?? null,
            additionalCompensationMinor: included ? 0 : optional ? tariff!.additionalCompensation!.costMinor : null,
            compensationStatus: !rate ? "outside-published-weight-range" : included ? "published-included-cover-subject-to-eligibility" : optional ? "published-optional-cover-subject-to-eligibility" : "insufficient-published-cover",
            customsChargesMinor: null, otherSurchargesMinor: null, finalQuote: false, approvalStatus: "unapproved",
            sourceUrl: tariff?.sourceUrl ?? null, rateId: rate?.id ?? null };
    }));
};
