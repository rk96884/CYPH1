type Outcome = Readonly<{ outcome: string }> | string;
export type WorkerTask = Readonly<{ name: "fulfilment" | "communications"; run: () => Promise<Outcome> }>;
export const waitForWorker = (milliseconds: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) { resolve(); return; }
  const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
  const timer = setTimeout(finish, milliseconds); signal.addEventListener("abort", finish, { once: true });
});
export async function runCommerceWorker(tasks: readonly WorkerTask[], signal: AbortSignal,
  log: (value: Readonly<{ event: string; consumer: string; outcome: string }>) => void,
  wait = waitForWorker) {
  await Promise.all(tasks.map(async task => {
    let delay = 250;
    while (!signal.aborted) {
      let outcome = "failed";
      try {
        const value = await task.run(); outcome = typeof value === "string" ? value : value.outcome;
      } catch { /* Deliberately omit error objects: they may contain secrets or PII. */ }
      const safe = ["processed","idle","failed","sent","empty","disabled","manual_review"].includes(outcome) ? outcome : "failed";
      if (!["empty","idle","disabled"].includes(safe)) log({ event: "commerce_worker_result", consumer: task.name, outcome: safe });
      delay = ["processed","sent"].includes(safe) ? 250 : Math.min(delay * 2, 5000);
      await wait(delay, signal);
    }
  }));
}
export const workerEnabled = (value: string | undefined) => {
  if (value !== undefined && !["true","false"].includes(value)) throw new Error("Invalid COMMERCE_WORKER_ENABLED.");
  return value === "true";
};
