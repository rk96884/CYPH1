import {runIsolatedOutboxConcurrency} from "./src/isolated-outbox-concurrency.mjs";
if(process.env.CYPH1_RUN_ISOLATED_OUTBOX_TEST!=="YES") throw new Error("Explicit development test opt-in required");
try {
  const result=await runIsolatedOutboxConcurrency(process.env.CYPH1_DEVELOPMENT_DATABASE_URL);
  console.log(JSON.stringify({event:"isolated_outbox_concurrency",...result}));
} catch {
  console.error(JSON.stringify({event:"isolated_outbox_concurrency",status:"failed"}));
  process.exitCode=1;
}
