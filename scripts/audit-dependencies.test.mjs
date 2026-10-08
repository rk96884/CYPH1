import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDependencyAudits } from "./audit-dependencies.mjs";

const clean = { vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
const approved = {
  vulnerabilities: {
    "@astrojs/check": { severity: "high", via: ["@astrojs/language-server"] },
    "@astrojs/language-server": { severity: "high", via: ["volar-service-yaml"] },
    ajv: { severity: "high", via: ["fast-uri"] },
    "ajv-draft-04": { severity: "high", via: ["ajv"] },
    "ajv-i18n": { severity: "high", via: ["ajv"] },
    "fast-uri": { severity: "high", via: [
      { url: "https://github.com/advisories/GHSA-5jgf-p345-68v8" },
      { url: "https://github.com/advisories/GHSA-f65p-4m7j-42xc" },
      { url: "https://github.com/advisories/GHSA-fph4-wmhf-6fwf" },
      { url: "https://github.com/advisories/GHSA-jqff-g426-hqxp" },
    ] },
    "volar-service-yaml": { severity: "high", via: ["yaml-language-server"] },
    "yaml-language-server": { severity: "high", via: ["ajv"] },
  },
};

test("clean production and complete audits pass without an exception", () => {
  assert.deepEqual(evaluateDependencyAudits({ production: clean, complete: clean }), { exception: false, advisories: 0 });
});

test("the exact development-only Astro advisory chain is temporarily accepted", () => {
  assert.deepEqual(evaluateDependencyAudits({
    production: clean, complete: approved, now: Date.parse("2026-09-07T12:00:00Z"),
  }), { exception: true, advisories: 4 });
});

test("policy rejection cases use a controlled pre-expiry date even when the wall clock is later", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2036-10-08T00:00:00Z") });
  const now = Date.parse("2026-09-07T12:00:00Z");
  assert.throws(() => evaluateDependencyAudits({
    production: { metadata: { vulnerabilities: { total: 1 } } }, complete: clean, now,
  }), /Production dependency audit/);
  assert.throws(() => evaluateDependencyAudits({
    production: clean, now,
    complete: { vulnerabilities: { unexpected: { severity: "high", via: [] } } },
  }), /unapproved vulnerable packages/);
  assert.throws(() => evaluateDependencyAudits({
    production: clean, now,
    complete: { vulnerabilities: { ...approved.vulnerabilities, "fast-uri": { severity: "high", via: [{ url: "https://github.com/advisories/GHSA-new" }] } } },
  }), /approved build-tool advisory set/);
});

const expiry = Date.parse("2026-10-08T00:00:00Z");
test("approved exception is accepted only before the real expiry boundary", () => {
  assert.deepEqual(evaluateDependencyAudits({ production: clean, complete: approved, now: expiry - 1 }), { exception: true, advisories: 4 });
});

for (const now of [expiry, expiry + 1, Date.parse("2036-10-08T00:00:00Z")]) {
  test(`approved exception is rejected at controlled date ${new Date(now).toISOString()}`, () => {
    assert.throws(() => evaluateDependencyAudits({ production: clean, complete: approved, now }), /exception has expired/);
  });
}

test("default wall-clock evaluation rejects an expired exception but permits clean audits", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: expiry + 1 });
  assert.throws(() => evaluateDependencyAudits({ production: clean, complete: approved }), /exception has expired/);
  assert.deepEqual(evaluateDependencyAudits({ production: clean, complete: clean }), { exception: false, advisories: 0 });
});
