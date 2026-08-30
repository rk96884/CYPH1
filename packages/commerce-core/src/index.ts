/**
 * Framework-neutral commerce domain boundary.
 *
 * This entry point exposes domain types and rules without framework, database,
 * storefront or payment-provider dependencies.
 */
export * from "./audit.js";
export * from "./basket.js";
export * from "./communication.js";
export * from "./errors.js";
export * from "./fulfilment.js";
export * from "./idempotency.js";
export * from "./money.js";
export * from "./payment-provider.js";
export * from "./shipping.js";
export * from "./state-machine.js";

export const commerceCoreVersion = "0.1.0" as const;
