import assert from "node:assert/strict";
import test from "node:test";
import { money, PaymentProviderError, type CreateCheckoutInput, type PaymentProvider, type ShippingRate, shippingZoneForCountry, trackedPostageMinor } from "../../../../packages/commerce-core/src/index.js";
import { CheckoutError, CheckoutService, type CheckoutOrder, type CheckoutRepository, type CheckoutResult } from "./service.js";

class MemoryCheckoutRepository implements CheckoutRepository {
  readonly orders: CheckoutOrder[] = [];
  readonly completed = new Map<string, CheckoutResult>();
  readonly abandoned: string[] = [];
  readonly resolutionRequired: string[] = [];
  attached: Parameters<CheckoutRepository["attachPayment"]>[0] | undefined;

  async getProduct() {
    return {
      id: "product_test", sku: "INTEGRATION-TEST", slug: "integration-test-fixture",
      name: "Integration test fixture", status: "private" as const,
      priceMinor: 10_000, unitTaxMinor: 2_000, currency: "GBP",
      shippingWeightGrams: 500, availableQuantity: 3,
    };
  }

  async getShipping(countryCode = "GB") {
    const zoneKey = shippingZoneForCountry(countryCode);
    const rate: ShippingRate = {
      id: "rate_test", version: 1, zoneKey, countryCode, methodKey: "tracked-postage-packing",
      methodName: "Test delivery", price: money(trackedPostageMinor[zoneKey], "GBP"), status: "test",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    };
    return { destination: { countryCode, zoneKey, status: "test" as const }, rates: [rate] };
  }

  async findCheckout(idempotencyKey: string) { return this.completed.get(idempotencyKey); }
  async createOrder(order: CheckoutOrder) { this.orders.push(order); }
  async attachPayment(input: Parameters<CheckoutRepository["attachPayment"]>[0]) {
    this.attached = input;
    const order = this.orders.find((candidate) => candidate.id === input.orderId);
    assert.ok(order);
    this.completed.set(input.idempotencyKey, {
      orderId: order.id, orderNumber: order.orderNumber, status: "pending_payment",
      checkoutUrl: input.checkoutUrl, replayed: false,
    });
  }
  async abandonOrder(orderId: string) { this.abandoned.push(orderId); }
  async markResolutionRequired(orderId: string) { this.resolutionRequired.push(orderId); }
}

const provider = (capture: CreateCheckoutInput[]): PaymentProvider => ({
  key: "mollie-test",
  async createCheckout(input) {
    capture.push(input);
    return {
      provider: "mollie-test", providerPaymentId: "tr_test", checkoutUrl: "https://www.mollie.com/checkout/test",
      status: input.method === "klarna" ? "authorised" : "pending", metadata: {},
    };
  },
  async getPayment() { throw new Error("not used"); },
  async refund() { throw new Error("not used"); },
  async verifyWebhook() { throw new Error("not used"); },
  async normaliseWebhook() { throw new Error("not used"); },
});

const request = (overrides = {}) => ({
  productSlug: "integration-test-fixture", quantity: 1, shippingRateId: "rate_test",
  email: "Test@Example.com", idempotencyKey: "checkout-test-1", correlationId: "correlation-test-1",
  deliveryAddress: {
    givenName: "Test", familyName: "Customer", line1: "1 Test Street", locality: "London",
    postalCode: "SW1A 1AA", countryCode: "GB",
  },
  ...overrides,
});

const urls = {
  orderStatusBaseUrl: "https://preview.example/orders",
  cancellationBaseUrl: "https://preview.example/orders",
  webhookUrl: "https://api.example/webhooks/mollie",
};

const serviceFor = (repository: MemoryCheckoutRepository, captured: CreateCheckoutInput[]) => new CheckoutService(
  { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
  repository, provider(captured), urls, true,
);

test("private checkout recalculates authoritative totals and creates a pending hosted checkout", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: CreateCheckoutInput[] = [];
  const result = await serviceFor(repository, captured).initiate(request());
  assert.equal(result.status, "pending_payment");
  assert.equal(result.replayed, false);
  assert.equal(captured[0]?.amount.value, 12_399);
  assert.equal(captured[0]?.lines.reduce((sum, line) => sum + line.totalAmount.value, 0), 12_399);
  assert.deepEqual(captured[0]?.customer, { email: "test@example.com" });
  assert.equal(captured[0]?.method, undefined);
  assert.equal(captured[0]?.shippingAddress, undefined);
  assert.equal(repository.orders[0]?.subtotalMinor, 10_000);
  assert.equal(repository.orders[0]?.taxMinor, 2_000);
  assert.equal(repository.orders[0]?.deliveryMinor, 399);
  assert.equal(repository.orders[0]?.email, "test@example.com");
  assert.equal(repository.orders[0]?.deliveryAddress.givenName, "Test");
  assert.equal(repository.orders[0]?.deliveryAddress.familyName, "Customer");
});

test("Klarna checkout sends structured billing and shipping data with manual capture", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: CreateCheckoutInput[] = [];
  await serviceFor(repository, captured).initiate(request({ paymentMethod: "klarna" }));
  const input = captured[0];
  assert.ok(input);
  assert.equal(input.method, "klarna");
  assert.equal(input.captureMode, "manual");
  assert.equal(repository.attached?.captureMode, "manual");
  assert.equal(repository.attached?.status, "authorised");
  assert.deepEqual(input.customer, {
    email: "test@example.com", givenName: "Test", familyName: "Customer",
    streetAndNumber: "1 Test Street", postalCode: "SW1A 1AA", city: "London", country: "GB",
  });
  assert.deepEqual(input.shippingAddress, input.customer);
});

test("checkout retries replay the stored hosted session without another provider call", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: CreateCheckoutInput[] = [];
  const service = serviceFor(repository, captured);
  await service.initiate(request());
  const replay = await service.initiate(request());
  assert.equal(replay.replayed, true);
  assert.equal(captured.length, 1);
});

test("checkout fails closed when commerce is disabled", async () => {
  const service = new CheckoutService(
    { commerceEnabled: false, paymentProvider: "disabled", fulfilmentMode: "disabled", fulfilmentProvider: "disabled" },
    new MemoryCheckoutRepository(), provider([]), urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "disabled");
});

test("private products require the explicit private-test boundary", async () => {
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
    new MemoryCheckoutRepository(), provider([]), urls, false,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "unavailable");
});

test("ambiguous retryable provider failures are held for resolution without cancelling the order", async () => {
  const repository = new MemoryCheckoutRepository();
  const failing = provider([]);
  failing.createCheckout = async () => { throw new PaymentProviderError("network_error", "timed out", true); };
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
    repository, failing, urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "provider_error");
  assert.equal(repository.orders.length, 1);
  assert.deepEqual(repository.resolutionRequired, [repository.orders[0]?.id]);
  assert.deepEqual(repository.abandoned, []);
});

test("definitive non-retryable provider failures abandon the draft order", async () => {
  const repository = new MemoryCheckoutRepository();
  const failing = provider([]);
  failing.createCheckout = async () => { throw new PaymentProviderError("validation_error", "rejected"); };
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
    repository, failing, urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "provider_error");
  assert.deepEqual(repository.abandoned, [repository.orders[0]?.id]);
  assert.deepEqual(repository.resolutionRequired, []);
});

for (const [countryCode, deliveryMinor] of [["GB", 399], ["DE", 1499], ["FR", 1499], ["TR", 1499], ["AE", 2599], ["SA", 2599], ["US", 2599], ["CA", 2599], ["AU", 2599]] as const) {
  test(`international test checkout calculates ${countryCode} totals server-side`, async () => {
    const repository = new MemoryCheckoutRepository();
    const captured: CreateCheckoutInput[] = [];
    const service = serviceFor(repository, captured);
    const quote = await service.quote({ productSlug: "integration-test-fixture", quantity: 1, countryCode });
    assert.equal(quote.deliveryMinor, deliveryMinor);
    assert.equal(quote.totalMinor, 12_000 + deliveryMinor);
    assert.equal(quote.importChargesNotice === null, countryCode === "GB");
    await service.initiate(request({ quantity: 1, importChargesAccepted: true, expectedTotalMinor: quote.totalMinor,
      deliveryMinor: 0, totalMinor: 1, shippingZone: "uk", currency: "USD",
      deliveryAddress: { ...request().deliveryAddress, countryCode, postalCode: countryCode === "AE" ? "" : "TEST POSTCODE" } }));
    assert.equal(repository.orders[0]?.deliveryMinor, deliveryMinor);
    assert.equal(repository.orders[0]?.totalMinor, 12_000 + deliveryMinor);
    assert.equal(captured[0]?.amount.value, quote.totalMinor);
    assert.equal(captured[0]?.amount.currency, "GBP");
    assert.equal(captured[0]?.lines.reduce((sum, line) => sum + line.totalAmount.value, 0), quote.totalMinor);
  });
}

test("international import charges require acknowledgement before creating an order/payment", async () => {
  const repository = new MemoryCheckoutRepository(); const captured: CreateCheckoutInput[] = [];
  await assert.rejects(() => serviceFor(repository, captured).initiate(request({ deliveryAddress: { ...request().deliveryAddress, countryCode: "DE" } })), /Acknowledge international import/);
  assert.equal(repository.orders.length, 0); assert.equal(captured.length, 0);
});

test("wrong-zone rate IDs and changed reviewed totals cannot initiate payment", async () => {
  const repository = new MemoryCheckoutRepository(); const captured: CreateCheckoutInput[] = [];
  const service = serviceFor(repository, captured);
  await assert.rejects(() => service.initiate(request({ shippingRateId: "cheap-uk-rate", importChargesAccepted: true, deliveryAddress: { ...request().deliveryAddress, countryCode: "AU" } })), /Select an available/);
  await assert.rejects(() => service.initiate(request({ expectedTotalMinor: 1 })), /total has changed/);
  assert.equal(repository.orders.length, 0); assert.equal(captured.length, 0);
});

test("disabled, restricted and absent destinations cannot quote or create paid orders", async () => {
  for (const approval of ["disabled", "restricted"] as const) {
    const repository = new MemoryCheckoutRepository(); const captured: CreateCheckoutInput[] = [];
    const original = repository.getShipping.bind(repository);
    const blocked: CheckoutRepository = { ...repository,
      getProduct: repository.getProduct.bind(repository), getShipping: async country => { const shipping = await original(country); return { ...shipping, destination: { ...shipping.destination, status: approval } }; },
      findCheckout: repository.findCheckout.bind(repository), createOrder: repository.createOrder.bind(repository), attachPayment: repository.attachPayment.bind(repository), abandonOrder: repository.abandonOrder.bind(repository), markResolutionRequired: repository.markResolutionRequired.bind(repository) };
    const service = new CheckoutService({ commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" }, blocked, provider(captured), urls, true);
    await assert.rejects(() => service.quote({ productSlug: "fixture", quantity: 1, countryCode: "DE" }), /not approved/);
    await assert.rejects(() => service.initiate(request({ importChargesAccepted: true, deliveryAddress: { ...request().deliveryAddress, countryCode: "DE" } })), /not approved/);
    assert.equal(captured.length, 0);
  }
});

test("mispriced rates and free-shipping overrides fail closed", async () => {
  for (const overrides of [{ price: money(399, "GBP") }, { freeShippingThreshold: 1 }]) {
    const repository = new MemoryCheckoutRepository();
    const original = repository.getShipping.bind(repository);
    repository.getShipping = async country => { const shipping = await original(country); return { ...shipping, rates: shipping.rates.map(rate => ({ ...rate, ...overrides })) }; };
    await assert.rejects(() => serviceFor(repository, []).quote({ productSlug: "fixture", quantity: 1, countryCode: "TR" }), /not approved/);
  }
});

test("private test boundary cannot permit test rates with a live provider", async () => {
  const live = { ...provider([]), key: "mollie-live" };
  const service = new CheckoutService({ commerceEnabled: true, paymentProvider: "mollie-live", fulfilmentMode: "live", fulfilmentProvider: "manual-live" }, new MemoryCheckoutRepository(), live, urls, true);
  await assert.rejects(() => service.initiate(request()), /not available/);
});

import { shippingSetupCountries, configureInternationalShipping } from "../runtime/configure-international-shipping.js";
import { PostgresCheckoutRepository } from "./postgres.js";
import pg from "pg";

test("shipping setup never permits production/live and defaults every destination to unapproved", async () => {
  const env = { NODE_ENV: "test", PAYMENT_PROVIDER: "mollie-test", COMMERCE_ENABLED: "false", SHIPPING_SETUP_CONFIRM: "international-test-only", DATABASE_URL: "postgres://local/commerce_test" };
  assert.deepEqual(shippingSetupCountries(env), []);
  assert.deepEqual(shippingSetupCountries({ ...env, SHIPPING_TEST_COUNTRIES: "GB,DE,FR,TR,AE,SA,US,CA,AU" }), ["GB","DE","FR","TR","AE","SA","US","CA","AU"]);
  for (const override of [{ NODE_ENV: "production" }, { PAYMENT_PROVIDER: "mollie-live" }, { COMMERCE_ENABLED: "true" }, { SHIPPING_SETUP_CONFIRM: "" }, { DATABASE_URL: "postgres://local/commerce" }, { SHIPPING_TEST_COUNTRIES: "UK" }]) assert.throws(() => shippingSetupCountries({ ...env, ...override }));
  const statements: { sql: string; values: unknown[] | undefined }[] = [];
  const client = { query: async (sql: string, values?: unknown[]) => { statements.push({ sql, values }); return { rowCount: sql.startsWith("SELECT country_code") ? 0 : 1, rows: [{ id: "method", zone_id: "zone" }] }; }, release() {} };
  await configureInternationalShipping({ connect: async () => client } as unknown as pg.Pool, ["DE", "TR"]);
  const destinations = statements.filter(statement => statement.sql.startsWith("UPDATE shipping_zone_countries"));
  assert.equal(destinations.length, 249);
  assert.deepEqual(destinations.filter(statement => statement.values?.[1] === "test").map(statement => statement.values?.[0]), ["DE","TR"]);
  assert.equal(destinations.filter(statement => statement.values?.[1] === "disabled").length, 247);
  assert.ok(statements.some(statement => statement.sql === "COMMIT"));
});

test("shipping snapshot rechecks destination approval and price under database locks before payment", async () => {
  const validRow = { method_key: "tracked-postage-packing", name: "Test delivery", description: "Includes packing", method_status: "test", rate_minor: 399, currency: "GBP", rate_status: "test", version: 1, country_code: "GB", zone_key: "uk", zone_status: "test", destination_status: "test", effective_from: new Date("2026-01-01"), effective_to: null, minimum_order_minor: null, maximum_order_minor: null, minimum_weight_grams: null, maximum_weight_grams: null, free_shipping_threshold_minor: null };
  for (const override of [{}, { destination_status: "disabled" }, { method_status: "disabled" }, { zone_status: "disabled" }, { rate_status: "disabled" }, { rate_minor: 1 }, { effective_to: new Date("2020-01-01") }]) {
    const statements: string[] = [];
    const client = { query: async (sql: string) => { statements.push(sql); if (sql.includes("SELECT price_minor,shipping_weight_grams")) return { rowCount: 1, rows: [{price_minor:10000,shipping_weight_grams:500,status:"private"}] }; if (sql.includes("FOR SHARE OF r")) return { rowCount: 1, rows: [{ ...validRow, ...override }] }; return { rowCount: 1, rows: [{ id: "customer" }] }; }, release() {} };
    const repository = new PostgresCheckoutRepository({ connect: async () => client } as unknown as pg.Pool);
    const memory = new MemoryCheckoutRepository(); await serviceFor(memory, []).initiate(request());
    const work = () => repository.createOrder(memory.orders[0]!, "key", "fingerprint");
    if (Object.keys(override).length) { await assert.rejects(work, /Shipping .*changed/); assert.ok(statements.includes("ROLLBACK")); }
    else { await work(); assert.ok(statements.includes("COMMIT")); }
    assert.ok(statements.some(statement => statement.includes("FOR SHARE OF r, m, z, c")));
  }
});

test("live provider rejects test shipping even for an active product", async () => {
  const memory = new MemoryCheckoutRepository();
  const repository: CheckoutRepository = {
    getProduct: async () => ({ ...await memory.getProduct(), status: "active" }),
    getShipping: memory.getShipping.bind(memory), findCheckout: memory.findCheckout.bind(memory),
    createOrder: memory.createOrder.bind(memory), attachPayment: memory.attachPayment.bind(memory),
    abandonOrder: memory.abandonOrder.bind(memory), markResolutionRequired: memory.markResolutionRequired.bind(memory),
  };
  const captured: CreateCheckoutInput[] = [];
  const service = new CheckoutService({ commerceEnabled: true, paymentProvider: "mollie-live", fulfilmentMode: "live", fulfilmentProvider: "manual-live" }, repository, { ...provider(captured), key: "mollie-live" }, urls, true);
  await assert.rejects(() => service.initiate(request()), /not approved/);
  assert.equal(captured.length, 0);
  assert.equal(memory.orders.length, 0);
});

test("absent destination configuration never reaches the payment provider", async () => {
  const memory = new MemoryCheckoutRepository();
  const repository: CheckoutRepository = {
    getProduct: memory.getProduct.bind(memory), getShipping: async () => undefined,
    findCheckout: memory.findCheckout.bind(memory), createOrder: memory.createOrder.bind(memory),
    attachPayment: memory.attachPayment.bind(memory), abandonOrder: memory.abandonOrder.bind(memory), markResolutionRequired: memory.markResolutionRequired.bind(memory),
  };
  const captured: CreateCheckoutInput[] = [];
  const service = new CheckoutService({ commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" }, repository, provider(captured), urls, true);
  await assert.rejects(() => service.initiate(request({ importChargesAccepted: true, deliveryAddress: { ...request().deliveryAddress, countryCode: "JP" } })), /not approved/);
  assert.equal(captured.length, 0);
});

import { MollieTestPaymentProvider } from "../payments/mollie-test.js";
for (const countryCode of ["GB","DE","FR","TR","AE","SA","US","CA","AU"]) {
  test(`Mollie test adapter receives the authoritative ${countryCode} checkout amount`, async () => {
    const repository = new MemoryCheckoutRepository();
    const expectedMinor = 12_000 + trackedPostageMinor[shippingZoneForCountry(countryCode)];
    let calls = 0;
    const adapter = new MollieTestPaymentProvider({
      apiKey: "test_example_key", allowedCallbackOrigins: ["https://preview.example", "https://api.example"],
      fetch: async (url, init) => {
        calls++;
        assert.equal(String(url), "https://api.mollie.com/v2/payments");
        const body = JSON.parse(String(init?.body)) as { amount: { value: string; currency: string } };
        assert.deepEqual(body.amount, { value: (expectedMinor / 100).toFixed(2), currency: "GBP" });
        return new Response(JSON.stringify({ id: "tr_fixture", status: "open", createdAt: "2026-10-08T10:00:00Z", amount: body.amount, _links: { checkout: { href: "https://www.mollie.com/checkout/test" } } }), { status: 201, headers: { "Content-Type": "application/json" } });
      },
    });
    const service = new CheckoutService({ commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" }, repository, adapter, urls, true);
    const result = await service.initiate(request({ importChargesAccepted: true, deliveryAddress: { ...request().deliveryAddress, countryCode } }));
    assert.equal(result.status, "pending_payment");
    assert.equal(calls, 1);
    assert.equal(repository.orders[0]?.totalMinor, expectedMinor);
  });
}


test("shipping snapshots bind revision, quantity, destination and weight; stale quotes cannot pay", async () => {
  class RevisedRepository extends MemoryCheckoutRepository {
    revision = 1;
    override async getShipping(country = "GB") {
      const shipping = await super.getShipping(country);
      return { ...shipping, rates: shipping.rates.map(rate => ({ ...rate, version: this.revision,
        minimumWeightGrams: 100, maximumWeightGrams: this.revision === 1 ? 2000 : 3000 })) };
    }
  }
  const repository = new RevisedRepository(); const calls: CreateCheckoutInput[] = [];
  const service = serviceFor(repository, calls);
  const quote = await service.quote({ productSlug: "integration-test-fixture", quantity: 1, countryCode: "DE" });
  const input = request({ importChargesAccepted: true, shippingQuoteRevision: quote.shippingQuoteRevision,
    expectedTotalMinor: quote.totalMinor, deliveryAddress: { ...request().deliveryAddress, countryCode: "DE" } });
  await service.initiate(input);
  const original = structuredClone(repository.orders[0]!);
  assert.equal(original.deliveryMinor, 1499);
  assert.equal(original.deliveryAddress.countryCode, "DE");
  assert.equal(original.shippingPricingSnapshot?.totalWeightGrams, 500);
  assert.equal(original.shippingPricingSnapshot?.minimumWeightGrams, 100);
  assert.equal(original.shippingPricingSnapshot?.maximumWeightGrams, 2000);
  assert.equal(original.shippingPricingSnapshot?.billableWeightGrams, null);
  assert.ok(original.shippingPricingSnapshot?.selectedAt);
  repository.revision = 2;
  const revised = await service.quote({ productSlug: "integration-test-fixture", quantity: 1, countryCode: "DE" });
  assert.notEqual(revised.shippingQuoteRevision, quote.shippingQuoteRevision);
  await assert.rejects(() => service.initiate({ ...input, idempotencyKey: "stale-revision" }), /quote changed/);
  const replay = await service.initiate(input);
  assert.equal(replay.replayed, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(repository.orders[0], original);
  await assert.rejects(() => service.quote({ productSlug: "integration-test-fixture", quantity: 2, countryCode: "DE" }), /packaging requires approval/);

});

test("failed or ambiguous payment attempts retain their original atomic pricing evidence", async () => {
  for (const retryable of [false, true]) {
    const repository = new MemoryCheckoutRepository();
    const payment = { ...provider([]), createCheckout: async () => { throw new PaymentProviderError("network_error", "synthetic failure", retryable); } };
    const service = new CheckoutService({ commerceEnabled:true,paymentProvider:"mollie-test",fulfilmentMode:"test",fulfilmentProvider:"manual-test" }, repository, payment, urls, true);
    await assert.rejects(() => service.initiate(request()), /could not be started/);
    assert.equal(repository.orders.length, 1);
    assert.equal(repository.orders[0]?.deliveryMinor, 399);
    assert.equal(repository.orders[0]?.shippingPricingSnapshot?.totalWeightGrams, 500);
    assert.equal(repository.attached, undefined);
    assert.equal((retryable ? repository.resolutionRequired : repository.abandoned).length, 1);
  }
});

// Entirely synthetic carrier rules: not a Royal Mail rate approval.
import { type CarrierTariff, type PackagingProfile } from "../../../../packages/commerce-core/src/index.js";
import { parseTariffSchedule, previewTariff, tariffChanges, validateTariffImportEnvironment } from "./tariff-import.js";
const syntheticTariff:CarrierTariff={carrier:"royal-mail",serviceId:"test-tracked",carrierZone:"test-uk",revision:"test-v1",sourceUrl:"https://example.invalid",retrievedAt:"2026-10-08T00:00:00Z",evidenceKind:"synthetic",available:true,tracked:true,
 maximumWeightGrams:20000,maximumDimensions:{lengthMm:610,widthMm:460,heightMm:460},weightBasis:"actual",fulfilmentMethod:"manual",includedCompensationMinor:100000,maximumInsurableValueMinor:100000,
 customs:"domestic",contentsApproved:true,restrictions:"Synthetic only",eligibilityEvidenceUrl:"https://example.invalid"};
const syntheticPackaging:PackagingProfile={id:"test-package",version:1,productId:"product_test",minimumQuantity:1,maximumQuantity:10,additionalWeightGrams:100,verificationStatus:"synthetic",dimensions:{lengthMm:400,widthMm:300,heightMm:300},fulfilmentMethod:"manual",status:"test"};
class CarrierRepository extends MemoryCheckoutRepository {
 tariff=syntheticTariff; packages:PackagingProfile[]=[syntheticPackaging];
 override async getShipping(countryCode="GB") {return {destination:{countryCode,zoneKey:shippingZoneForCountry(countryCode),status:"test" as const},rates:[
  {id:"carrier",version:1,zoneKey:shippingZoneForCountry(countryCode),countryCode,methodKey:"test-carrier",methodName:"Test carrier",price:money(777,"GBP"),status:"test" as const,effectiveFrom:new Date("2026-01-01"),minimumWeightGrams:1,maximumWeightGrams:20000,carrierTariff:this.tariff},
  ...(await super.getShipping(countryCode)).rates]};}
 async getPackagingProfiles(){return this.packages;}
}
test("carrier quote and checkout preserve packaging, tariff and payment totals; stale changes never pay",async()=>{
 const repository=new CarrierRepository();const calls:CreateCheckoutInput[]=[];const service=serviceFor(repository,calls);
 const quote=await service.quote({productSlug:"integration-test-fixture",quantity:2,countryCode:"GB"});assert.equal(quote.deliveryMinor,777);
 const one=await service.quote({productSlug:"integration-test-fixture",quantity:1,countryCode:"GB"});
 assert.notEqual(one.shippingQuoteRevision,quote.shippingQuoteRevision);
 await assert.rejects(()=>service.initiate(request({quantity:2,shippingRateId:quote.shippingRateId,shippingQuoteRevision:one.shippingQuoteRevision})),/quote changed/);
 const input=request({quantity:2,shippingRateId:quote.shippingRateId,shippingQuoteRevision:quote.shippingQuoteRevision,expectedTotalMinor:quote.totalMinor});
 await service.initiate(input);assert.equal(calls[0]?.amount.value,24777);
 const saved=repository.orders[0]!.shippingPricingSnapshot;assert.equal(saved.totalWeightGrams,1100);assert.equal(saved.billableWeightGrams,1100);
 assert.equal(saved.carrierCalculation?.merchandiseValueMinor,24000);assert.equal(saved.packagingProfileVersion,1);
 repository.tariff={...syntheticTariff,revision:"test-v2"};
 await assert.rejects(()=>service.initiate({...input,idempotencyKey:"stale-tariff"}),CheckoutError);
 repository.tariff=syntheticTariff;repository.packages=[{...syntheticPackaging,version:2,additionalWeightGrams:200}];
 await assert.rejects(()=>service.initiate({...input,idempotencyKey:"stale-packaging"}),CheckoutError);assert.equal(calls.length,1);
 const replay=await service.initiate(input);assert.equal(replay.replayed,true);assert.deepEqual(repository.orders[0]!.shippingPricingSnapshot,saved);
});
test("approved carrier failure cannot fall back to a cheaper legacy flat rate",async()=>{
 const r=new CarrierRepository();r.packages=[];await assert.rejects(()=>serviceFor(r,[]).quote({productSlug:"integration-test-fixture",quantity:2,countryCode:"GB"}));
 r.packages=[syntheticPackaging];r.tariff={...syntheticTariff,available:false};await assert.rejects(()=>serviceFor(r,[]).quote({productSlug:"integration-test-fixture",quantity:1,countryCode:"GB"}));
});
test("reviewed import requires disabled complete non-overlapping versioned evidence and previews without activation",()=>{
 const rate:ShippingRate={id:"import",version:1,zoneKey:"uk",countryCode:"GB",methodKey:"test",methodName:"Test",price:money(777,"GBP"),status:"disabled",effectiveFrom:new Date("2026-01-01"),minimumWeightGrams:1,maximumWeightGrams:20000,carrierTariff:syntheticTariff};
 const raw={revision:"test-v1",rates:[rate],packagingProfiles:[{...syntheticPackaging,status:"disabled"}]};
 const schedule=parseTariffSchedule(JSON.parse(JSON.stringify(raw)));
 assert.equal(previewTariff(schedule,"product_test",953,7499,new Date("2026-10-08"))[5]?.shippingMinor,777);
 assert.equal(schedule.rates[0]?.status,"disabled");assert.throws(()=>parseTariffSchedule({...raw,rates:[{...rate,status:"active"}]}));
 assert.throws(()=>parseTariffSchedule({...raw,rates:[rate,{...rate,id:"overlap",version:2}]}));
 assert.throws(()=>parseTariffSchedule({...raw,rates:[{...rate,carrierTariff:{...syntheticTariff,evidenceKind:"official"}}]}));
 const revised=parseTariffSchedule({...raw,rates:[{...rate,id:"new",version:2,price:money(888,"GBP"),maximumWeightGrams:19000}]});
 assert.equal(tariffChanges(schedule,revised)[0]?.previousPriceMinor,777);assert.equal(tariffChanges(schedule,revised)[0]?.priceMinor,888);
});

test("tariff import guards reject production, enabled gates, non-test payments and unconfirmed revisions/databases",()=>{
 const env={NODE_ENV:"test",COMMERCE_ENABLED:"false",CHECKOUT_HTTP_ENABLED:"false",PAYMENT_WEBHOOKS_ENABLED:"false",PRIVATE_CHECKOUT_FIXTURE_ENABLED:"false",PAYMENT_PROVIDER:"mollie-test",TARIFF_IMPORT_APPROVED_REVISION:"v1",DATABASE_URL:"postgres://localhost/commerce_test",CONFIRM_NON_PRODUCTION_DATABASE:"commerce_test"};
 validateTariffImportEnvironment(env,"v1");
 for(const change of [{NODE_ENV:"production"},{COMMERCE_ENABLED:"true"},{CHECKOUT_HTTP_ENABLED:"true"},{PAYMENT_WEBHOOKS_ENABLED:"true"},{PRIVATE_CHECKOUT_FIXTURE_ENABLED:"true"},{PAYMENT_PROVIDER:"mollie-live"},{TARIFF_IMPORT_APPROVED_REVISION:"v2"},{CONFIRM_NON_PRODUCTION_DATABASE:"other"},{DATABASE_URL:"postgres://localhost/production_test",CONFIRM_NON_PRODUCTION_DATABASE:"production_test"}]) assert.throws(()=>validateTariffImportEnvironment({...env,...change},"v1"));
});

test("checkout selects the cheapest eligible carrier charge including optional cover",async()=>{
 const r=new CarrierRepository();const original=r.getShipping.bind(r);
 r.getShipping=async(country="GB")=>{const s=await original(country);const base=s.rates[0]!;return {...s,rates:[...s.rates,{...base,id:"lower-postage-but-cover",methodKey:"other",price:money(500,"GBP"),carrierTariff:{...syntheticTariff,includedCompensationMinor:5000,additionalCompensation:{coverMinor:100000,costMinor:500}}}]};};
 const q=await serviceFor(r,[]).quote({productSlug:"integration-test-fixture",quantity:1,countryCode:"GB"});assert.equal(q.shippingRateId,"carrier");assert.equal(q.deliveryMinor,777);
});

test("checkout never treats provisional multi-unit packaging as verified", async()=>{
 const r=new CarrierRepository();r.packages=[{...syntheticPackaging,verificationStatus:"provisional"} as PackagingProfile];
 const calls:CreateCheckoutInput[]=[];
 await assert.rejects(()=>serviceFor(r,calls).quote({productSlug:"integration-test-fixture",quantity:2,countryCode:"GB"}));
 assert.equal(calls.length,0);assert.equal(r.orders.length,0);
});

// Real published data are validated without importing or activating database rows.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { comparePublishedPostage } from "./tariff-import.js";
const publishedRaw=()=>JSON.parse(readFileSync(resolve(process.cwd(),"tariffs/royal-mail-online-2026-10-05-v1.json"),"utf8"));
test("official schedule expands shared Royal Mail zone bands deterministically and remains disabled",()=>{
 const raw=publishedRaw();const schedule=parseTariffSchedule(raw);assert.equal(raw.rates.length,152);assert.equal(schedule.rates.length,232);
 assert.equal(new Set(schedule.rates.map(rate=>rate.id)).size,232);
 assert.deepEqual(schedule,parseTariffSchedule(raw));
 assert.deepEqual([...new Set(schedule.rates.map(rate=>rate.countryCode))].sort(),["AE","AU","BH","CA","DE","ES","FR","GB","IE","KW","OM","QA","SA","TR","US"]);
 for(const rate of schedule.rates){assert.equal(rate.status,"disabled");assert.equal(rate.carrierTariff?.available,false);assert.equal(rate.carrierTariff?.contentsApproved,false);assert.equal(rate.carrierTariff?.evidenceKind,"official");assert.equal(rate.effectiveFrom.toISOString(),"2026-10-05T00:00:00.000Z");}
 const gulf=schedule.rates.filter(rate=>rate.carrierTariff?.carrierZone==="world-1" && rate.countryCode!=="CA");
 assert.equal(gulf.length,96);assert.ok(gulf.every(rate=>rate.carrierTariff?.carrierZone==="world-1"));
 assert.throws(()=>parseTariffSchedule({...raw,rates:[{...raw.rates[0],countryCode:undefined,countryCodes:["GB","GB"]}]}));
 assert.throws(()=>parseTariffSchedule({...raw,rates:[{...raw.rates[0],countryCodes:["GB"]}]}));
});
test("published quantity comparisons use confirmed weights, real bands and separate incomplete charges",()=>{
 const rows=comparePublishedPostage(parseTariffSchedule(publishedRaw()));assert.equal(rows.length,320);
 const find=(country:string,method:string,quantity:number)=>rows.find(row=>row.countryCode===country && row.methodKey===method && row.quantity===quantity)!;
 assert.equal(find("GB","royal-mail-tracked-48-small-parcel",1).basePostageMinor,375);
 assert.equal(find("GB","royal-mail-tracked-48-small-parcel",2).basePostageMinor,null);
 assert.equal(find("DE","royal-mail-international-tracked",1).basePostageMinor,995);
 assert.equal(find("DE","royal-mail-international-tracked-heavier",2).basePostageMinor,1260);
 assert.equal(find("DE","royal-mail-international-tracked-heavier",3).basePostageMinor,1370);
 assert.equal(find("TR","royal-mail-international-tracked",1).basePostageMinor,1675);
 assert.equal(find("AE","royal-mail-international-tracked",1).basePostageMinor,2775);
 assert.equal(find("US","royal-mail-international-tracked",1).basePostageMinor,2020);
 assert.equal(find("CA","royal-mail-international-tracked",1).basePostageMinor,2295);
 assert.equal(find("AU","royal-mail-international-tracked",1).basePostageMinor,2510);
 for(const quantity of [1,2,3,4,5,6,7,8,9,10]) assert.equal(find("DE","royal-mail-international-tracked-heavier",quantity).weightGrams,quantity===1?1061:953*quantity+150);
 assert.equal(find("DE","royal-mail-international-tracked",1).additionalCompensationMinor,310);
 assert.equal(find("DE","royal-mail-international-tracked-heavier",4).compensationStatus,"insufficient-published-cover");
 assert.ok(rows.every(row=>!row.finalQuote && row.approvalStatus==="unapproved" && row.customsChargesMinor===null && row.otherSurchargesMinor===null));
 const changed=comparePublishedPostage(parseTariffSchedule(publishedRaw()),{unitWeightGrams:953,singleUnitProtectionGrams:108,multiUnitProtectionGrams:200});
 assert.equal(changed.find(row=>row.quantity===2)?.weightGrams,2106);
});
