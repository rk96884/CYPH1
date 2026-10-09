import { CommerceDomainError } from "./errors.js";
export const inpostCollectionMethod = "inpost-locker-shop";
export const inpostCollectionMinor = 259;
export type CollectionPoint = Readonly<{ name: string; address: string; postalCode: string; locationId?: string }>;
const text = (value: unknown, maximum: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new CommerceDomainError("invalid_collection_point", "Complete the collection point details.");
  return value.trim();
};
export const normaliseCollectionPoint = (value: unknown): CollectionPoint => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CommerceDomainError("invalid_collection_point", "Complete the collection point details.");
  const point = value as Record<string, unknown>;
  if (Object.keys(point).some(key => !["name","address","postalCode","locationId"].includes(key))) throw new CommerceDomainError("invalid_collection_point", "Invalid collection point details.");
  const postalCode = text(point.postalCode, 10).toUpperCase().replace(/\s+/g, "");
  if (!/^(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(postalCode)) throw new CommerceDomainError("invalid_collection_point", "Enter a UK collection point postcode.");
  if (point.locationId !== undefined && typeof point.locationId !== "string") throw new CommerceDomainError("invalid_collection_point", "InPost location ID must be text.");
  const locationId = typeof point.locationId === "string" && point.locationId.trim() ? text(point.locationId,40) : undefined;
  return Object.freeze({name:text(point.name,150),address:text(point.address,500),postalCode:postalCode.slice(0,-3)+" "+postalCode.slice(-3),...(locationId ? {locationId} : {})});
};
export const normaliseUkMobile = (value: unknown): string => {
  const number = text(value, 30).replace(/[ ()-]/g, "");
  if (!/^(?:07\d{9}|\+447\d{9})$/.test(number)) throw new CommerceDomainError("invalid_collection_point", "Enter a UK mobile number for InPost notifications.");
  return number.startsWith("07") ? "+44"+number.slice(1) : number;
};

/** The full combined detail stays in address; name is only a derived short display label. */
export const collectionPointFromCombinedDetails = (details: string, postalCode: string, locationId?: string): CollectionPoint => {
  const address = text(details,500);
  return normaliseCollectionPoint({name:address.slice(0,150),address,postalCode,...(locationId !== undefined ? {locationId} : {})});
};
