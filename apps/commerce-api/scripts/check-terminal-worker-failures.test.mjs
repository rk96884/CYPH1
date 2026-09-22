import test from "node:test";
import assert from "node:assert/strict";
import { formatTerminalFailureSummary } from "./check-terminal-worker-failures.mjs";

test("zero terminal failures emits only aggregate zero counts",()=>{
  assert.deepEqual(formatTerminalFailureSummary({fulfilmentCount:0,communicationCount:0}),[
    "Fulfilment terminal failures: 0","Communication terminal failures: 0"
  ]);
});
test("failure summary exposes counts and age but no identifiers",()=>{
  const lines=formatTerminalFailureSummary({fulfilmentCount:1,communicationCount:2,oldestCreatedAt:new Date("2026-09-22T12:00:00Z")},new Date("2026-09-22T12:12:00Z"));
  assert.deepEqual(lines,["Fulfilment terminal failures: 1","Communication terminal failures: 2","Oldest outstanding failure age: 12 minutes"]);
});
