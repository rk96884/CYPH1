import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import {
  calculateBasket, inpostCollectionMethod, inpostCollectionMinor, normaliseCollectionPoint, normaliseUkMobile, type CollectionPoint,
  normaliseCountryCode, shippingZoneForCountry, trackedPostageMinor, trackedPostageMethod, importChargesNotice,
  CommerceDomainError,
  money,
  PaymentProviderError,
  quoteShipping,
  transitionOrder,
  type PaymentMethod,
  type PaymentProvider,
  type ShippingDestination,
  type ShippingRate, type PackagingProfile, type CarrierCalculation,
} from "../../../../packages/commerce-core/src/index.js";
import type { CommerceConfig } from "../config.js";

export type CheckoutProduct = Readonly<{
  id: string; sku: string; slug: string; name: string; status: "private" | "active";
  priceMinor: number; unitTaxMinor: number; currency: string; shippingWeightGrams: number; availableQuantity: number;
}>;

export type CheckoutAddress = Readonly<{
  givenName: string;
  familyName: string;
  line1: string;
  line2?: string;
  locality: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string; collectionPoint?: CollectionPoint;
}>;

export type InitiateCheckoutInput = Readonly<{
  productSlug: string; quantity: number; shippingRateId: string; email: string;
  deliveryAddress: CheckoutAddress; paymentMethod?: PaymentMethod;
  importChargesAccepted?: boolean; expectedTotalMinor?: number;
  shippingQuoteRevision?: string; deliveryMethod?: string;
  idempotencyKey: string; correlationId: string;
}>;

export type CheckoutOrder = Readonly<{
  id: string; orderNumber: string; status: "draft" | "pending_payment"; product: CheckoutProduct; quantity: number;
  subtotalMinor: number; taxMinor: number; deliveryMinor: number; totalMinor: number; currency: string;
  shippingRateId: string; email: string; deliveryAddress: CheckoutAddress;
  shippingPricingSnapshot: ShippingPricingSnapshot;
  shippingApproval?: "test" | "active"; importChargesAccepted?: boolean;
}>;

export type ShippingPricingSnapshot = Readonly<{
  schemaVersion: 2; rateRevision: string; quoteRevision: string; selectedAt: string;
  quantity: number; totalWeightGrams: number; billableWeightGrams: number | null;
  minimumWeightGrams: number | null; maximumWeightGrams: number | null;
  minimumSubtotalMinor: number | null; maximumSubtotalMinor: number | null;
  carrierCalculation?: CarrierCalculation;
  packagingProfileVersion: number | null; rateCountryCode: string | null;
  effectiveFrom: string; effectiveTo: string | null; freeShippingThresholdMinor: null;
}>;

export const canonicalShippingJson = (value: unknown): string => JSON.stringify(value, (_key, entry) =>
  entry && typeof entry === "object" && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);

/** Content identity supplements the persisted rate ID/version; no mutable lookup is needed to audit an order. */
export const shippingRateRevision = (rate: ShippingRate): string => createHash("sha256").update(canonicalShippingJson({
  ...(rate.carrierTariff ? { carrierTariff: rate.carrierTariff } : {}),
  id: rate.id, version: rate.version ?? null, zoneKey: rate.zoneKey, countryCode: rate.countryCode ?? null,
  methodKey: rate.methodKey, methodName: rate.methodName, amountMinor: rate.price.value, currency: rate.price.currency,
  minimumSubtotal: rate.minimumSubtotal ?? null, maximumSubtotal: rate.maximumSubtotal ?? null,
  minimumWeightGrams: rate.minimumWeightGrams ?? null, maximumWeightGrams: rate.maximumWeightGrams ?? null,
  freeShippingThreshold: rate.freeShippingThreshold ?? null,
  effectiveFrom: rate.effectiveFrom.toISOString(), effectiveTo: rate.effectiveTo?.toISOString() ?? null,
})).digest("hex");

export type CheckoutResult = Readonly<{ orderId: string; orderNumber: string; status: "pending_payment"; checkoutUrl: string; replayed: boolean }>;

export interface CheckoutRepository {
  getPackagingProfiles?(productId: string): Promise<readonly PackagingProfile[]>;
  getProduct(slug: string): Promise<CheckoutProduct | undefined>;
  getShipping(destinationCountry: string): Promise<Readonly<{ destination: ShippingDestination; rates: readonly ShippingRate[] }> | undefined>;
  findCheckout(idempotencyKey: string, fingerprint: string): Promise<CheckoutResult | undefined>;
  createOrder(order: CheckoutOrder, idempotencyKey: string, fingerprint: string): Promise<void>;
  attachPayment(input: Readonly<{ orderId: string; provider: string; providerPaymentId: string; amountMinor: number; currency: string; idempotencyKey: string; checkoutUrl: string; status?: "pending" | "authorised"; captureMode?: "manual" | "automatic"; captureBefore?: string; authorisedAt?: string }>): Promise<void>;
  abandonOrder(orderId: string): Promise<void>;
  markResolutionRequired(orderId: string): Promise<void>;
}

export class CheckoutError extends Error {
  constructor(readonly code: "disabled" | "invalid_request" | "unavailable" | "conflict" | "provider_error", message: string) {
    super(message); this.name = "CheckoutError";
  }
}

type CheckoutUrls = Readonly<{ orderStatusBaseUrl: string; cancellationBaseUrl: string; webhookUrl: string }>;
const requireText = (value: string, field: string): string => { const normalised = value.trim(); if (!normalised) throw new CheckoutError("invalid_request", `${field} is required.`); return normalised; };
const normaliseEmail = (value: string): string => { const email = requireText(value, "Email address").toLowerCase(); if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("invalid_request", "Enter a valid email address."); return email; };
const paymentName = (value: string, field: string): string => { const name = requireText(value, field); if (name.length < 2 || /^\d+$/.test(name)) throw new CheckoutError("invalid_request", `${field} must contain at least two characters and cannot be only numbers.`); return name; };
const orderReference = (id: string): string => `CYPH-T-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const fingerprint = (input: InitiateCheckoutInput): string => createHash("sha256").update(JSON.stringify({ productSlug: input.productSlug, quantity: input.quantity, shippingRateId: input.shippingRateId, email: input.email.trim().toLowerCase(), deliveryAddress: input.deliveryAddress, paymentMethod: input.paymentMethod ?? null, deliveryMethod: input.deliveryMethod ?? trackedPostageMethod, importChargesAccepted: input.importChargesAccepted === true, shippingQuoteRevision: input.shippingQuoteRevision ?? null, expectedTotalMinor: input.expectedTotalMinor ?? null })).digest("hex");

export class CheckoutService {
  constructor(private readonly config: CommerceConfig, private readonly repository: CheckoutRepository, private readonly paymentProvider: PaymentProvider, private readonly urls: CheckoutUrls, private readonly allowPrivateProducts = false) {}

  private get testShippingAllowed(): boolean {
    return this.allowPrivateProducts && this.config.paymentProvider === "mollie-test"
      && this.config.fulfilmentMode === "test" && this.config.fulfilmentProvider === "manual-test";
  }

  private async price(input: Readonly<{ productSlug: string; quantity: number; countryCode: string; deliveryMethod?: string }>) {
    if (!this.config.commerceEnabled || this.config.paymentProvider !== this.paymentProvider.key) throw new CheckoutError("disabled", "Commerce is not enabled.");
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) throw new CheckoutError("invalid_request", "Quantity must be between 1 and 10.");
    let country: string;
    try { country = normaliseCountryCode(input.countryCode); }
    catch { throw new CheckoutError("invalid_request", "Select a valid ISO country code."); }
    const deliveryMethod = input.deliveryMethod ?? trackedPostageMethod;
    const collection = deliveryMethod === inpostCollectionMethod;
    if (![trackedPostageMethod, inpostCollectionMethod].includes(deliveryMethod)) throw new CheckoutError("invalid_request", "Select an available delivery method.");
    if (collection && (!this.testShippingAllowed || country !== "GB" || input.quantity !== 1)) throw new CheckoutError("unavailable", "InPost collection requires UK single-unit test checkout; launch approval remains pending.");
    const product = await this.repository.getProduct(requireText(input.productSlug, "Product"));
    if (!product || (product.status !== "active" && !(this.testShippingAllowed && product.status === "private"))) throw new CheckoutError("unavailable", "This product is not available for checkout.");
    if (product.availableQuantity < input.quantity || product.priceMinor <= 0) throw new CheckoutError("unavailable", "The requested quantity is not available.");
    const shipping = await this.repository.getShipping(country);
    const zone = shippingZoneForCountry(country);
    if (!shipping || shipping.destination.countryCode !== country) throw new CheckoutError("unavailable", "Shipping is not approved for this destination.");
    const lines = [{ productId: product.id, sku: product.sku, quantity: input.quantity, unitPrice: money(product.priceMinor, product.currency), unitTax: money(product.unitTaxMinor, product.currency), unitWeightGrams: product.shippingWeightGrams }];
    const provisional = calculateBasket(lines, money(0, product.currency), money(0, product.currency));
    try {
      const carrierRates = shipping.rates.filter(rate => !collection && rate.carrierTariff && (rate.status === "active" || (this.testShippingAllowed && rate.status === "test")));
      const packagingProfiles = carrierRates.length ? await this.repository.getPackagingProfiles?.(product.id) ?? [] : [];
      // Approved carrier configuration takes precedence, even when it yields no eligible service.
      // Legacy flat rates remain a single-unit staging fallback, never a multi-unit packaging approval.
      if (!carrierRates.length && input.quantity > 1) throw new CheckoutError("unavailable", "Multi-unit packaging requires approval.");
      const quotes = quoteShipping({ ...shipping, rates: carrierRates.length ? carrierRates : shipping.rates.filter(rate => rate.methodKey === deliveryMethod && rate.price.currency === "GBP" && rate.price.value === (collection ? inpostCollectionMinor : trackedPostageMinor[zone]) && rate.freeShippingThreshold === undefined),
        basketSubtotal: provisional.subtotal, totalWeightGrams: provisional.totalWeightGrams, allowTestRates: this.testShippingAllowed,
        shipment: {productId:product.id,quantity:input.quantity,unitWeightGrams:product.shippingWeightGrams,
          merchandiseValueMinor:provisional.subtotal.value+provisional.tax.value,packagingProfiles} });
      const quote = [...quotes].sort((a,b)=>a.price.value-b.price.value || a.rateId.localeCompare(b.rateId))[0]!;
      const basket = calculateBasket(lines, money(0, product.currency), quote.price);
      const rate = shipping.rates.find(candidate => candidate.id === quote.rateId)!;
      const rateRevision = shippingRateRevision(rate);
      const quoteRevision = createHash("sha256").update(canonicalShippingJson({ rateRevision, countryCode: country,
        productId: product.id, quantity: input.quantity, unitPriceMinor: product.priceMinor, unitTaxMinor: product.unitTaxMinor,
        ...(quote.carrierCalculation ? { carrierCalculation: quote.carrierCalculation } : {}),
        totalWeightGrams: basket.totalWeightGrams, totalMinor: basket.total.value, currency: basket.total.currency })).digest("hex");
      const snapshot: ShippingPricingSnapshot = Object.freeze({ schemaVersion: 2, rateRevision, quoteRevision,
        selectedAt: new Date().toISOString(), quantity: input.quantity, totalWeightGrams: quote.carrierCalculation?.actualWeightGrams ?? basket.totalWeightGrams,
        ...(quote.carrierCalculation ? { carrierCalculation: quote.carrierCalculation } : {}),
        billableWeightGrams: quote.carrierCalculation?.billableWeightGrams ?? null, minimumWeightGrams: rate.minimumWeightGrams ?? null,
        maximumWeightGrams: rate.maximumWeightGrams ?? null, minimumSubtotalMinor: rate.minimumSubtotal ?? null,
        maximumSubtotalMinor: rate.maximumSubtotal ?? null, packagingProfileVersion: quote.carrierCalculation?.packaging.version ?? null,
        rateCountryCode: rate.countryCode ?? null, effectiveFrom: rate.effectiveFrom.toISOString(),
        effectiveTo: rate.effectiveTo?.toISOString() ?? null, freeShippingThresholdMinor: null });
      return { product, quote, basket, snapshot };
    } catch (error) {
      if (error instanceof CommerceDomainError) throw new CheckoutError("unavailable", "Shipping is not approved for this destination.");
      throw error;
    }
  }

  async quote(input: Readonly<{ productSlug: string; quantity: number; countryCode: string; deliveryMethod?: string }>) {
    const { quote, basket, snapshot } = await this.price(input);
    return Object.freeze({ shippingQuoteRevision: snapshot.quoteRevision, shippingRateId: quote.rateId, countryCode: quote.countryCode, zoneKey: quote.zoneKey, methodKey: quote.methodKey, methodName: quote.methodName,
      subtotalMinor: basket.subtotal.value, taxMinor: basket.tax.value, deliveryMinor: basket.delivery.value, totalMinor: basket.total.value, currency: basket.total.currency,
      importChargesNotice: quote.countryCode === "GB" ? null : importChargesNotice });
  }

  async initiate(input: InitiateCheckoutInput): Promise<CheckoutResult> {
    if (!this.config.commerceEnabled || this.config.paymentProvider !== this.paymentProvider.key) throw new CheckoutError("disabled", "Commerce is not enabled.");
    const idempotencyKey = requireText(input.idempotencyKey, "Idempotency key");
    const requestFingerprint = fingerprint(input);
    const replay = await this.repository.findCheckout(idempotencyKey, requestFingerprint);
    if (replay) return Object.freeze({ ...replay, replayed: true });
    if (input.paymentMethod !== undefined && input.paymentMethod !== "klarna") throw new CheckoutError("invalid_request", "Unsupported payment method.");
    const { product, quote, basket, snapshot } = await this.price({ productSlug: input.productSlug, quantity: input.quantity, countryCode: input.deliveryAddress.countryCode, ...(input.deliveryMethod ? {deliveryMethod:input.deliveryMethod} : {}) });
    if (input.shippingQuoteRevision !== undefined && input.shippingQuoteRevision !== snapshot.quoteRevision)
      throw new CheckoutError("conflict", "Shipping quote changed. Review a new quote before payment.");
    if (quote.rateId !== input.shippingRateId) throw new CheckoutError("invalid_request", "Select an available shipping method.");
    if (quote.countryCode !== "GB" && input.importChargesAccepted !== true) throw new CheckoutError("invalid_request", "Acknowledge international import charges before payment.");
    if (input.expectedTotalMinor !== undefined && input.expectedTotalMinor !== basket.total.value) throw new CheckoutError("conflict", "Your total has changed. Review a new quote before payment.");

    let collectionPoint: CollectionPoint | undefined, phone: string | undefined;
    if (quote.methodKey === inpostCollectionMethod) {
      if (input.paymentMethod === "klarna") throw new CheckoutError("unavailable", "Klarna collection checkout requires separate provider validation.");
      try { collectionPoint = normaliseCollectionPoint(input.deliveryAddress.collectionPoint); phone = normaliseUkMobile(input.deliveryAddress.phone); }
      catch (error) { if (error instanceof CommerceDomainError) throw new CheckoutError("invalid_request", error.message); throw error; }
    } else if (input.deliveryAddress.collectionPoint !== undefined) throw new CheckoutError("invalid_request", "Collection point details require InPost delivery.");
    const orderId = randomUUID();
    const orderNumber = orderReference(orderId);
    const email = normaliseEmail(input.email);
    const deliveryAddress = Object.freeze({
      ...(phone ? {phone} : {}), ...(collectionPoint ? {collectionPoint} : {}),
      ...(input.deliveryAddress.line2 ? {line2:input.deliveryAddress.line2.trim()} : {}),
      ...(input.deliveryAddress.region ? {region:input.deliveryAddress.region.trim()} : {}),
      givenName: paymentName(input.deliveryAddress.givenName, "First name"),
      familyName: paymentName(input.deliveryAddress.familyName, "Last name"),
      line1: requireText(input.deliveryAddress.line1, "Address line 1"),
      locality: requireText(input.deliveryAddress.locality, "Town or city"),
      postalCode: quote.countryCode === "AE" ? input.deliveryAddress.postalCode.trim() : requireText(input.deliveryAddress.postalCode, "Postcode"),
      countryCode: quote.countryCode,
    });
    const order: CheckoutOrder = Object.freeze({ id: orderId, orderNumber, status: "draft", product, quantity: input.quantity, subtotalMinor: basket.subtotal.value, taxMinor: basket.tax.value, deliveryMinor: basket.delivery.value, totalMinor: basket.total.value, currency: basket.total.currency, shippingRateId: quote.rateId, shippingPricingSnapshot: snapshot, email, deliveryAddress, shippingApproval: this.testShippingAllowed ? "test" : "active", importChargesAccepted: quote.countryCode !== "GB" && input.importChargesAccepted === true });
    await this.repository.createOrder(order, idempotencyKey, requestFingerprint);

    try {
      const paymentAddress = Object.freeze({
        email: order.email,
        givenName: order.deliveryAddress.givenName,
        familyName: order.deliveryAddress.familyName,
        streetAndNumber: order.deliveryAddress.line1,
        ...(order.deliveryAddress.line2?.trim() ? { streetAdditional: order.deliveryAddress.line2.trim() } : {}),
        postalCode: order.deliveryAddress.postalCode,
        city: order.deliveryAddress.locality,
        ...(order.deliveryAddress.region?.trim() ? { region: order.deliveryAddress.region.trim() } : {}),
        country: order.deliveryAddress.countryCode,
      });
      const checkout = await this.paymentProvider.createCheckout({
        orderId, orderNumber, amount: basket.total,
        lines: [
          { description: product.name, quantity: input.quantity, unitPrice: money(product.priceMinor + product.unitTaxMinor, product.currency), totalAmount: money((product.priceMinor + product.unitTaxMinor) * input.quantity, product.currency) },
          ...(basket.delivery.value > 0 ? [{ description: quote.methodName, quantity: 1, unitPrice: basket.delivery, totalAmount: basket.delivery }] : []),
        ],
        customer: input.paymentMethod === "klarna" ? paymentAddress : { email: order.email },
        ...(input.paymentMethod === "klarna" ? { shippingAddress: paymentAddress, method: "klarna" as const, captureMode: "manual" as const } : {}),
        successUrl: `${this.urls.orderStatusBaseUrl}?order=${encodeURIComponent(orderId)}`,
        cancellationUrl: `${this.urls.cancellationBaseUrl}?order=${encodeURIComponent(orderId)}`,
        webhookUrl: this.urls.webhookUrl,
        idempotencyKey,
        correlationId: requireText(input.correlationId, "Correlation ID"),
      });
      await this.repository.attachPayment({ orderId, provider: checkout.provider, providerPaymentId: checkout.providerPaymentId, amountMinor: basket.total.value, currency: basket.total.currency, idempotencyKey, checkoutUrl: checkout.checkoutUrl,
        status: checkout.status === "authorised" ? "authorised" : "pending",
        ...(checkout.captureMode ? { captureMode: checkout.captureMode } : input.paymentMethod === "klarna" ? { captureMode: "manual" as const } : {}),
        ...(checkout.captureBefore ? { captureBefore: checkout.captureBefore } : {}), ...(checkout.authorisedAt ? { authorisedAt: checkout.authorisedAt } : {}),
      });
      transitionOrder("draft", "pending_payment");
      return Object.freeze({ orderId, orderNumber, status: "pending_payment", checkoutUrl: checkout.checkoutUrl, replayed: false });
    } catch (error) {
      if (error instanceof PaymentProviderError && error.retryable) await this.repository.markResolutionRequired(orderId); else await this.repository.abandonOrder(orderId);
      if (error instanceof CheckoutError) throw error;
      throw new CheckoutError("provider_error", "Checkout could not be started. Please try again.");
    }
  }
}
