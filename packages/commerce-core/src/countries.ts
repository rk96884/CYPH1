import { CommerceDomainError } from "./errors.js";

// Assigned ISO 3166-1 alpha-2 codes (territories retain their own destination code).
export const countryCodes: readonly string[] = Object.freeze("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" "));
const assigned = new Set(countryCodes);
// UN M49 Europe, with Cyprus and Turkey explicitly included for commercial pricing.
const europe = new Set("AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM TR UA VA".split(" "));
export const normaliseCountryCode = (value: string): string => {
  const code = value.trim().toUpperCase();
  if (!assigned.has(code)) throw new CommerceDomainError("invalid_country", "Select an assigned ISO country code.");
  return code;
};
export type ShippingZone = "uk" | "europe" | "rest-of-world";
export const shippingZoneForCountry = (value: string): ShippingZone => {
  const code = normaliseCountryCode(value);
  return code === "GB" ? "uk" : europe.has(code) ? "europe" : "rest-of-world";
};
export const trackedPostageMinor = Object.freeze({ uk: 399, europe: 1499, "rest-of-world": 2599 });
export const trackedPostageMethod = "tracked-postage-packing";
export const importChargesNotice = "International import duties, taxes and customs clearance charges are not included in your order total and must be paid separately by the recipient where applicable.";

/** Approved UK customer charges; checkout eligibility is controlled separately. */
export const ukTrackedPostageForQuantity = (quantity: number): number => {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 3) throw new CommerceDomainError("invalid_quantity", "Quantity must be a whole number between 1 and 3.");
  return quantity === 1 ? 399 : 799;
};

/**
 * Customer-facing reporting/administration regions. These are deliberately
 * separate from the three existing pricing zones and never grant eligibility.
 * Destinations are only offered when explicitly enabled in shipping tables.
 */
export type ShippingRegion = "UK" | "Europe" | "APAC" | "Middle East" | "LATAM" | "Rest of World";
const middleEast = new Set("AE BH IL IQ JO KW LB OM PS QA SA YE".split(" "));
const latam = new Set("AR BO BR BZ CL CO CR CU DO EC GF GT GY HN HT MX NI PA PE PY SR SV UY VE".split(" "));
const asia = new Set("AF AM AZ BD BN BT CN GE HK ID IN JP KG KH KP KR KZ LA LK MM MN MO MY NP PH PK SG TH TJ TL TM TW UZ VN".split(" "));
export const shippingRegionForCountry = (value: string): ShippingRegion => {
  const code = normaliseCountryCode(value);
  if (code === "GB") return "UK";
  if (europe.has(code)) return "Europe";
  if (middleEast.has(code)) return "Middle East";
  if (latam.has(code)) return "LATAM";
  if (asia.has(code) || code === "AU" || code === "NZ") return "APAC";
  return "Rest of World";
};
/** Commercially excluded launch destination regardless of pricing zone. */
export const isExcludedLaunchCountry = (value: string): boolean => normaliseCountryCode(value) === "US";
