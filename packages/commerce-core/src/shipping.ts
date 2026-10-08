import { calculateCarrierShipment, type CarrierTariff, type CarrierCalculation, type PackagingProfile } from "./carrier-tariff.js";
import { normaliseCountryCode } from "./countries.js";
import { CommerceDomainError } from "./errors.js";
import { money, type Money } from "./money.js";

export type ShippingStatus = "disabled" | "test" | "active" | "restricted";

export type ShippingDestination = Readonly<{
  countryCode: string;
  zoneKey: string;
  status: ShippingStatus;
}>;

export type ShippingRate = Readonly<{
  id: string;
  version?: number;
  carrierTariff?: CarrierTariff;
  zoneKey: string;
  countryCode?: string;
  methodKey: string;
  methodName: string;
  price: Money;
  status: Exclude<ShippingStatus, "restricted">;
  minimumSubtotal?: number;
  maximumSubtotal?: number;
  minimumWeightGrams?: number;
  maximumWeightGrams?: number;
  freeShippingThreshold?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
}>;

export type ShippingQuote = Readonly<{
  rateId: string;
  carrierCalculation?: CarrierCalculation;
  countryCode: string;
  zoneKey: string;
  methodKey: string;
  methodName: string;
  price: Money;
}>;

const countryCode = normaliseCountryCode;

export const quoteShipping = (input: Readonly<{
  destination: ShippingDestination;
  rates: readonly ShippingRate[];
  basketSubtotal: Money;
  totalWeightGrams: number;
  at?: Date;
  shipment?: Readonly<{ productId: string; quantity: number; unitWeightGrams: number; merchandiseValueMinor: number; packagingProfiles: readonly PackagingProfile[]; allowProvisionalEstimates?: boolean }>;
  allowTestRates?: boolean;
}>): readonly ShippingQuote[] => {
  const destinationCountry = countryCode(input.destination.countryCode);
  if (input.destination.status !== "active" && !(input.allowTestRates && input.destination.status === "test")) {
    throw new CommerceDomainError("unsupported_shipping_destination", "Shipping is not available for this destination.");
  }
  if (!Number.isSafeInteger(input.totalWeightGrams) || input.totalWeightGrams <= 0) {
    throw new CommerceDomainError("invalid_weight", "Shipment weight must be a positive integer in grams.");
  }

  const at = input.at ?? new Date();
  const calculations = new Map<string, CarrierCalculation>();
  const eligible = input.rates.filter((rate) => {
    if (rate.zoneKey !== input.destination.zoneKey || rate.price.currency !== input.basketSubtotal.currency) return false;
    if (rate.status !== "active" && !(input.allowTestRates && rate.status === "test")) return false;
    if (rate.countryCode && countryCode(rate.countryCode) !== destinationCountry) return false;
    if (rate.effectiveFrom > at || (rate.effectiveTo && rate.effectiveTo <= at)) return false;
    if (rate.minimumSubtotal !== undefined && input.basketSubtotal.value < rate.minimumSubtotal) return false;
    if (rate.maximumSubtotal !== undefined && input.basketSubtotal.value > rate.maximumSubtotal) return false;
    let weight = input.totalWeightGrams;
    if (rate.carrierTariff) {
      if (!input.shipment || !rate.countryCode || rate.price.currency !== "GBP" || rate.minimumWeightGrams === undefined || rate.maximumWeightGrams === undefined || rate.freeShippingThreshold !== undefined) return false;
      const matches = input.shipment.packagingProfiles.map(packaging => calculateCarrierShipment({
        ...input.shipment!, tariff: rate.carrierTariff!, packaging, countryCode: destinationCountry, allowTestRates: input.allowTestRates === true,
      })).filter((c): c is CarrierCalculation => c !== undefined);
      if (matches.length > 1) throw new CommerceDomainError("ambiguous_packaging", "Multiple packaging profiles match this shipment.");
      const calculation = matches[0];
      if (!calculation) return false;
      calculations.set(rate.id, calculation); weight = calculation.billableWeightGrams;
    }
    if (rate.minimumWeightGrams !== undefined && weight < rate.minimumWeightGrams) return false;
    if (rate.maximumWeightGrams !== undefined && weight > rate.maximumWeightGrams) return false;
    return true;
  });

  const byMethod = new Map<string, ShippingRate>();
  for (const rate of eligible) {
    const current = byMethod.get(rate.methodKey);
    if (!current || (!current.countryCode && rate.countryCode)) {
      byMethod.set(rate.methodKey, rate);
      continue;
    }
    if (Boolean(current.countryCode) === Boolean(rate.countryCode)) {
      throw new CommerceDomainError("ambiguous_shipping_rate", `Multiple shipping rates match method ${rate.methodKey}.`);
    }
  }

  const quotes = [...byMethod.values()].map((rate): ShippingQuote => Object.freeze({
    rateId: rate.id,
    ...(calculations.has(rate.id) ? { carrierCalculation: calculations.get(rate.id)! } : {}),
    countryCode: destinationCountry,
    zoneKey: rate.zoneKey,
    methodKey: rate.methodKey,
    methodName: rate.methodName,
    price: rate.freeShippingThreshold !== undefined && input.basketSubtotal.value >= rate.freeShippingThreshold
      ? money(0, rate.price.currency)
      : money(rate.price.value + (calculations.get(rate.id)?.additionalCompensationMinor ?? 0), rate.price.currency),
  }));
  if (quotes.length === 0) {
    throw new CommerceDomainError("no_shipping_rate", "No shipping method matches this basket and destination.");
  }
  return Object.freeze(quotes);
};
