import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import worker,{runSyntheticConsumer} from "./src/synthetic-consumer-cpu-worker.mjs";

test("disabled is side-effect free and public HTTP is unavailable",async()=>{
  assert.deepEqual(await runSyntheticConsumer({}),{status:"disabled"});
  assert.equal((await worker.fetch()).status,404);
});

test("actual communication consumer processes only fake synthetic order",async()=>{
  const result=await runSyntheticConsumer({SYNTHETIC_CPU_TEST_ENABLED:"true"});
  assert.equal(result.status,"verified");
  assert.ok(result.wallMs>=0);
});

test("configuration has no Hyperdrive, secrets or recurring triggers",async()=>{
  const config=await readFile(new URL("./wrangler.synthetic-cpu.toml",import.meta.url),"utf8");
  assert.match(config,/SYNTHETIC_CPU_TEST_ENABLED = "false"/);
  assert.doesNotMatch(config,/\[triggers\]|\[\[hyperdrive\]\]|BREVO_API_KEY|DATABASE_URL/);
});
