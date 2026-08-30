import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import {
  calculateBasket,
  money,
  PaymentProviderError,
  quoteShipping,
  transitionOrder,
  type PaymentProvider,
  type ShippingDestination,
  type ShippingRate,
} from "../../../../packages/commerce-core/src/index.js";
import type { CommerceConfig } from "../config.js";

export type CheckoutProduct = Readonly<{
  id: string;
  sku: string;
  slug: string;
  name: string;
  status: "private" | "active";
  priceMinor: number;
  unitTaxMinor: number;
  currency: string;
  shippingWeightGrams: number;
  availableQuantity: number;
}>;

export type CheckoutAddress = Readonly<{
  recipientName: string;
  line1: string;
  line2?: string;
  locality: string;
  region?: string;
  postalCode: string;
  countryCode: string;
}>;

export type InitiateCheckoutInput = Readonly<{
  productSlug: string;
  quantity: number;
  shippingRateId: string;
  email: string;
  deliveryAddress: CheckoutAddress;
  idempotencyKey: string;
  correlationId: string;
}>;

export type CheckoutOrder = Readonly<{
  id: string;
  orderNumber: string;
  status: "draft" | "pending_payment";
  product: CheckoutProduct;
  quantity: number;
  subtotalMinor: number;
  taxMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  currency: string;
  shippingRateId: string;
  email: string;
  deliveryAddress: CheckoutAddress;
}>;

export type CheckoutResult = Readonly<{
  orderId: string;
  orderNumber: string;
  status: "pending_payment";
  checkoutUrl: string;
  replayed: boolean;
}>;

export interface CheckoutRepository {
  getProduct(slug: string): Promise<CheckoutProduct | undefined>;
  getShipping(destinationCountry: string): Promise<Readonly<{
    destination: ShippingDestination;
    rates: readonly ShippingRate[];
  }> | undefined>;
  findCheckout(idempotencyKey: string, fingerprint: string): Promise<CheckoutResult | undefined>;
  createOrder(order: CheckoutOrder, idempotencyKey: string, fingerprint: string): Promise<void>;
  attachPayment(input: Readonly<{
    orderId: string;
    provider: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    checkoutUrl: string;
  }>): Promise<void>;
  abandonOrder(orderId: string): Promise<void>;
  markResolutionRequired(orderId: string): Promise<void>;
}

export class CheckoutError extends Error {
  constructor(
    readonly code: "disabled" | "invalid_request" | "unavailable" | "conflict" | "provider_error",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

type CheckoutUrls = Readonly<{
  orderStatusBaseUrl: string;
  cancellationBaseUrl: string;
  webhookUrl: string;
}>;

const requireText = (value: string, field: string): string => {
  const normalised = value.trim();
  if (!normalised) throw new CheckoutError("invalid_request", `${field} is required.`);
  return normalised;
};

const normaliseEmail = (value: string): string => {
  const email = requireText(value, "Email address").toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CheckoutError("invalid_request", "Enter a valid email address.");
  }
  return email;
};

const orderReference = (id: string): string => `CYPH-T-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const fingerprint = (input: InitiateCheckoutInput): string => createHash("sha256").update(JSON.stringify({
  productSlug: input.productSlug,
  quantity: input.quantity,
  shippingRateId: input.shippingRateId,
  email: input.email.trim().toLowerCase(),
  deliveryAddress: input.deliveryAddress,
})).digest("hex");

export class CheckoutService {
  constructor(
    private readonly config: CommerceConfig,
    private readonly repository: CheckoutRepository,
    private readonly paymentProvider: PaymentProvider,
    private readonly urls: CheckoutUrls,
    private readonly allowPrivateProducts = false,
  ) {}

  async initiate(input: InitiateCheckoutInput): Promise<CheckoutResult> {
    if (!this.config.commerceEnabled || this.config.paymentProvider !== this.paymentProvider.key) {
      throw new CheckoutError("disabled", "Commerce is not enabled.");
    }
    const idempotencyKey = requireText(input.idempotencyKey, "Idempotency key");
    const requestFingerprint = fingerprint(input);
    const replay = await this.repository.findCheckout(idempotencyKey, requestFingerprint);
    if (replay) return Object.freeze({ ...replay, replayed: true });
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || input.quantity > 10) {
      throw new CheckoutError("invalid_request", "Quantity must be between 1 and 10.");
    }

    const product = await this.repository.getProduct(requireText(input.productSlug, "Product"));
    if (!product || (product.status !== "active" && !(this.allowPrivateProducts && product.status === "private"))) {
      throw new CheckoutError("unavailable", "This product is not available for checkout.");
    }
    if (product.availableQuantity < input.quantity || product.priceMinor <= 0) {
      throw new CheckoutError("unavailable", "The requested quantity is not available.");
    }

    const shipping = await this.repository.getShipping(input.deliveryAddress.countryCode);
    if (!shipping) throw new CheckoutError("unavailable", "Shipping is not available for this destination.");
    const provisional = calculateBasket([
      {
        productId: product.id,
        sku: product.sku,
        quantity: input.quantity,
        unitPrice: money(product.priceMinor, product.currency),
        unitTax: money(product.unitTaxMinor, product.currency),
        unitWeightGrams: product.shippingWeightGrams,
      },
    ], money(0, product.currency), money(0, product.currency));
    const quotes = quoteShipping({
      ...shipping,
      basketSubtotal: provisional.subtotal,
      totalWeightGrams: provisional.totalWeightGrams,
      allowTestRates: this.allowPrivateProducts,
    });
    const quote = quotes.find((candidate) => candidate.rateId === input.shippingRateId);
    if (!quote) throw new CheckoutError("invalid_request", "Select an available shipping method.");
    const basket = calculateBasket([
      {
        productId: product.id,
        sku: product.sku,
        quantity: input.quantity,
        unitPrice: money(product.priceMinor, product.currency),
        unitTax: money(product.unitTaxMinor, product.currency),
        unitWeightGrams: product.shippingWeightGrams,
      },
    ], money(0, product.currency), quote.price);

    const orderId = randomUUID();
    const orderNumber = orderReference(orderId);
    const order: CheckoutOrder = Object.freeze({
      id: orderId,
      orderNumber,
      status: "draft",
      product,
      quantity: input.quantity,
      subtotalMinor: basket.subtotal.value,
      taxMinor: basket.tax.value,
      deliveryMinor: basket.delivery.value,
      totalMinor: basket.total.value,
      currency: basket.total.currency,
      shippingRateId: quote.rateId,
      email: normaliseEmail(input.email),
      deliveryAddress: Object.freeze({
        ...input.deliveryAddress,
        recipientName: requireText(input.deliveryAddress.recipientName, "Recipient name"),
        line1: requireText(input.deliveryAddress.line1, "Address line 1"),
        locality: requireText(input.deliveryAddress.locality, "Town or city"),
        postalCode: requireText(input.deliveryAddress.postalCode, "Postcode"),
        countryCode: quote.countryCode,
      }),
    });
    await this.repository.createOrder(order, idempotencyKey, requestFingerprint);

    try {
      const checkout = await this.paymentProvider.createCheckout({
        orderId,
        orderNumber,
        amount: basket.total,
        lines: [
          {
            description: product.name,
            quantity: input.quantity,
            unitPrice: money(product.priceMinor + product.unitTaxMinor, product.currency),
            totalAmount: money((product.priceMinor + product.unitTaxMinor) * input.quantity, product.currency),
          },
          ...(basket.delivery.value > 0 ? [{
            description: quote.methodName,
            quantity: 1,
            unitPrice: basket.delivery,
            totalAmount: basket.delivery,
          }] : []),
        ],
        customer: { email: order.email },
        successUrl: `${this.urls.orderStatusBaseUrl}?order=${encodeURIComponent(orderId)}`,
        cancellationUrl: `${this.urls.cancellationBaseUrl}?order=${encodeURIComponent(orderId)}`,
        webhookUrl: this.urls.webhookUrl,
        idempotencyKey,
        correlationId: requireText(input.correlationId, "Correlation ID"),
      });
      await this.repository.attachPayment({
        orderId,
        provider: checkout.provider,
        providerPaymentId: checkout.providerPaymentId,
        amountMinor: basket.total.value,
        currency: basket.total.currency,
        idempotencyKey,
        checkoutUrl: checkout.checkoutUrl,
      });
      transitionOrder("draft", "pending_payment");
      return Object.freeze({ orderId, orderNumber, status: "pending_payment", checkoutUrl: checkout.checkoutUrl, replayed: false });
    } catch (error) {
      if (error instanceof PaymentProviderError && error.retryable) {
        await this.repository.markResolutionRequired(orderId);
      } else {
        await this.repository.abandonOrder(orderId);
      }
      if (error instanceof CheckoutError) throw error;
      throw new CheckoutError("provider_error", "Checkout could not be started. Please try again.");
    }
  }
}
