# CYPH/1 Payment-provider Contract

**Status:** Language-neutral contract; TypeScript implementation will follow during scaffolding

## Objective

Prevent Mollie, Square, Stripe or any future provider from defining CYPH/1 order logic. Provider adapters translate between external APIs and a stable internal contract.

## Provider registry

The server selects an adapter using server-side configuration. Provider names, credentials and fallback rules must not be supplied by the browser.

```text
PaymentProviderRegistry
  getConfiguredProvider(): PaymentProvider
  getProvider(providerKey): PaymentProvider
```

Automatic failover during an in-progress payment is not permitted. Switching provider creates a new payment attempt against the same order under an explicit policy.

## Core contract

```ts
type Currency = "GBP";
type MinorAmount = { currency: Currency; value: number };

interface PaymentProvider {
  readonly key: string;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getPayment(input: GetPaymentInput): Promise<NormalisedPayment>;
  refund(input: RefundInput): Promise<NormalisedRefund>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook>;
  normaliseWebhook(input: VerifiedWebhook): Promise<PaymentEvent[]>;
}
```

The eventual code should use branded/validated types rather than accepting arbitrary numbers and strings at trust boundaries.

## `CreateCheckoutInput`

- Internal order ID and customer-facing order number.
- Authoritative amount and currency.
- Immutable line-item descriptions required by the provider.
- Approved customer fields only.
- HTTPS success, cancellation and webhook URLs selected by the server.
- A unique idempotency key.
- Correlation ID for safe diagnostics.

It must not accept a browser-calculated total or arbitrary callback domain.

## `CheckoutSession`

- Provider key.
- Provider payment/session ID.
- Hosted checkout URL.
- Normalised initial status.
- Optional expiry time.
- Safe provider metadata required for reconciliation.

The hosted URL must be validated against the adapter's expected provider domains before being returned.

## `NormalisedPayment`

- Internal order reference when recoverable.
- Provider and provider payment ID.
- Normalised status.
- Amount and currency.
- Created, authorised, paid, cancelled or expired timestamps where available.
- Refundable amount.
- Safe failure category, not raw sensitive provider output.

## `RefundInput`

- Internal payment and order IDs.
- Provider payment ID loaded by the server.
- Amount and currency.
- Approved reason code and operator audit context.
- Unique idempotency key.

Adapters must reject over-refunds before calling the provider.

## Webhook contract

`VerifyWebhookInput` contains the raw, unparsed request bytes, original headers and configured endpoint URL where required by the provider signature scheme.

`VerifiedWebhook` must distinguish:

- verified and actionable;
- verified but irrelevant;
- invalid signature/authenticity;
- malformed payload.

Normalised webhook events include:

```ts
type PaymentEvent = {
  eventId: string;
  provider: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  type:
    | "payment.pending"
    | "payment.authorised"
    | "payment.paid"
    | "payment.failed"
    | "payment.cancelled"
    | "payment.expired"
    | "refund.pending"
    | "refund.completed"
    | "refund.failed"
    | "dispute.opened"
    | "dispute.updated";
  occurredAt: string;
  amount?: MinorAmount;
};
```

## Error categories

Adapters convert provider errors into stable internal categories:

- `configuration_error`
- `authentication_error`
- `validation_error`
- `payment_declined`
- `rate_limited`
- `provider_unavailable`
- `network_error`
- `conflict`
- `not_found`
- `unknown_provider_error`

Only retry explicitly transient categories. Customer-facing messages must not expose provider internals.

## Idempotency and retries

- The commerce service creates idempotency keys; adapters do not invent them silently.
- Repeating the same command with the same key must not create another charge or refund.
- Timeouts are treated as unknown outcomes until the provider is queried or a webhook resolves them.
- A new payment attempt uses a new key and record while retaining the original order.

## Adapter acceptance tests

Every adapter must pass the same contract suite:

- successful checkout creation;
- rejected invalid totals/currency;
- retry after timeout without duplicate payment;
- paid, failed, cancelled and expired normalisation;
- valid and invalid webhook signatures;
- duplicate and out-of-order events;
- full and partial refunds;
- over-refund rejection;
- provider outage behaviour;
- safe logging and redaction.

Provider-specific tests supplement but do not replace this suite.
