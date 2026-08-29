import { CommerceDomainError } from "./errors.js";

type Stored<Result> = { fingerprint: string; state: "pending" | "complete"; result?: Result };

export class InMemoryIdempotencyStore<Result> {
  readonly #records = new Map<string, Stored<Result>>();

  reserve(key: string, fingerprint: string): "acquired" | Stored<Result> {
    const existing = this.#records.get(key);
    if (existing) return existing;
    this.#records.set(key, { fingerprint, state: "pending" });
    return "acquired";
  }

  complete(key: string, fingerprint: string, result: Result): void {
    this.#records.set(key, { fingerprint, state: "complete", result });
  }

  release(key: string, fingerprint: string): void {
    if (this.#records.get(key)?.fingerprint === fingerprint) this.#records.delete(key);
  }
}

export const executeIdempotent = async <Result>(input: Readonly<{
  key: string;
  fingerprint: string;
  store: InMemoryIdempotencyStore<Result>;
  execute: () => Promise<Result>;
}>): Promise<Readonly<{ result: Result; replayed: boolean }>> => {
  if (!input.key.trim() || !input.fingerprint.trim()) {
    throw new CommerceDomainError("invalid_idempotency_key", "An idempotency key and request fingerprint are required.");
  }
  const reservation = input.store.reserve(input.key, input.fingerprint);
  if (reservation !== "acquired") {
    if (reservation.fingerprint !== input.fingerprint) throw new CommerceDomainError("idempotency_conflict", "The idempotency key was reused for a different request.");
    if (reservation.state === "pending") throw new CommerceDomainError("command_in_progress", "A command with this idempotency key is in progress.");
    return Object.freeze({ result: reservation.result as Result, replayed: true });
  }
  try {
    const result = await input.execute();
    input.store.complete(input.key, input.fingerprint, result);
    return Object.freeze({ result, replayed: false });
  } catch (error) {
    input.store.release(input.key, input.fingerprint);
    throw error;
  }
};
