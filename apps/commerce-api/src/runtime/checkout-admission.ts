type Environment = Readonly<Record<string, string | undefined>>;
type Handler = (request: Request) => Promise<Response>;
type Clock = () => number;

export type CheckoutAdmissionConfig = Readonly<{
  maximumConcurrent: number;
  windowRequests: number;
  windowMilliseconds: number;
}>;

const integer = (value: string | undefined, name: string, minimum: number, maximum: number): number => {
  if (!value?.trim() || !/^\d+$/.test(value)) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return result;
};

export const loadCheckoutAdmissionConfig = (environment: Environment): CheckoutAdmissionConfig => Object.freeze({
  maximumConcurrent: integer(environment.CHECKOUT_ADMISSION_MAX_CONCURRENT, "CHECKOUT_ADMISSION_MAX_CONCURRENT", 1, 100),
  windowRequests: integer(environment.CHECKOUT_ADMISSION_WINDOW_REQUESTS, "CHECKOUT_ADMISSION_WINDOW_REQUESTS", 1, 10_000),
  windowMilliseconds: integer(environment.CHECKOUT_ADMISSION_WINDOW_SECONDS, "CHECKOUT_ADMISSION_WINDOW_SECONDS", 1, 3_600) * 1_000,
});

type Admission = Readonly<{ admitted: true; release(): void }> | Readonly<{ admitted: false; retryAfterSeconds: number }>;

export class CheckoutAdmissionController {
  readonly #timestamps: number[] = [];
  #active = 0;

  constructor(readonly config: CheckoutAdmissionConfig, readonly clock: Clock = Date.now) {}

  acquire(): Admission {
    const now = this.clock();
    const threshold = now - this.config.windowMilliseconds;
    while (this.#timestamps.length > 0 && this.#timestamps[0]! <= threshold) this.#timestamps.shift();

    if (this.#active >= this.config.maximumConcurrent) {
      return Object.freeze({ admitted: false, retryAfterSeconds: 1 });
    }
    if (this.#timestamps.length >= this.config.windowRequests) {
      const retryAt = this.#timestamps[0]! + this.config.windowMilliseconds;
      return Object.freeze({ admitted: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1_000)) });
    }

    this.#active += 1;
    this.#timestamps.push(now);
    let released = false;
    return Object.freeze({
      admitted: true,
      release: () => {
        if (!released) {
          released = true;
          this.#active -= 1;
        }
      },
    });
  }
}

const rejected = (retryAfterSeconds: number, request: Request, allowedOrigin: string): Response => {
  const origin = request.headers.get("origin");
  return new Response(JSON.stringify({ message: "Checkout is temporarily busy." }), {
    status: 429,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "no-referrer",
      "Retry-After": String(retryAfterSeconds),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      ...(origin === allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}),
    },
  });
};

export const withCheckoutAdmission = (
  handler: Handler,
  controller: CheckoutAdmissionController,
  allowedOrigin: string,
): Handler => async (request) => {
  if (request.method !== "POST") return handler(request);
  const admission = controller.acquire();
  if (!admission.admitted) return rejected(admission.retryAfterSeconds, request, allowedOrigin);
  try { return await handler(request); }
  finally { admission.release(); }
};
