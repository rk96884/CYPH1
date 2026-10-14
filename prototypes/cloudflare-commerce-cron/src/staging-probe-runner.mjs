import { claimOne } from "./hyperdrive-transaction-harness.mjs";

/**
 * An explicitly injected pg-like connection factory; never reads environment,
 * creates clients, or schedules itself. Each caller owns cleanup and security.
 * Limit is intentionally tiny to avoid impacting staging.
 */
export async function runStagingProbe(openClient, limit = 2) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2) throw new Error("Unsafe staging probe batch limit");
  const client = await openClient();
  try {
    const claims = [];
    for (let i = 0; i < limit; i++) {
      const id = await claimOne(client);
      if (id === null) break;
      claims.push(id);
    }
    return Object.freeze({ claimed: claims });
  } finally {
    await client.release();
  }
}
