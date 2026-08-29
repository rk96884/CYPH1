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
  countryCode: string;
  zoneKey: string;
  methodKey: string;
  methodName: string;
  price: Money;
}>;

const countryCode = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new CommerceDomainError("invalid_country", "Country must be a two-letter ISO code.");
  }
  return normalized;
};

export const quoteShipping = (input: Readonly<{
  destination: ShippingDestination;
  rates: readonly ShippingRate[];
  basketSubtotal: Money;
  totalWeightGrams: number;
  at?: Date;
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
  const eligible = input.rates.filter((rate) => {
    if (rate.zoneKey !== input.destination.zoneKey || rate.price.currency !== input.basketSubtotal.currency) return false;
    if (rate.status !== "active" && !(input.allowTestRates && rate.status === "test")) return false;
    if (rate.countryCode && countryCode(rate.countryCode) !== destinationCountry) return false;
    if (rate.effectiveFrom > at || (rate.effectiveTo && rate.effectiveTo <= at)) return false;
    if (rate.minimumSubtotal !== undefined && input.basketSubtotal.value < rate.minimumSubtotal) return false;
    if (rate.maximumSubtotal !== undefined && input.basketSubtotal.value > rate.maximumSubtotal) return false;
    if (rate.minimumWeightGrams !== undefined && input.totalWeightGrams < rate.minimumWeightGrams) return false;
    if (rate.maximumWeightGrams !== undefined && input.totalWeightGrams > rate.maximumWeightGrams) return false;
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
    countryCode: destinationCountry,
    zoneKey: rate.zoneKey,
    methodKey: rate.methodKey,
    methodName: rate.methodName,
    price: rate.freeShippingThreshold !== undefined && input.basketSubtotal.value >= rate.freeShippingThreshold
      ? money(0, rate.price.currency)
      : rate.price,
  }));
  if (quotes.length === 0) {
    throw new CommerceDomainError("no_shipping_rate", "No shipping method matches this basket and destination.");
  }
  return Object.freeze(quotes);
};
