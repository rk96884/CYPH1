# Dependency and runtime security

**Status:** Automated engineering baseline; production runtime review outstanding  
**Last engineering update:** 7 September 2026

## Purpose

Keep third-party package and build-workflow risk visible without applying
unreviewed upgrades to a commerce system. This procedure covers npm packages,
GitHub Actions and the Node.js runtime used by GitHub and Render.

## Automated controls

- `npm ci` installs exactly the dependency graph recorded in
  `package-lock.json`; CI does not generate a replacement lockfile.
- `npm run audit:dependencies` fails for any production vulnerability, any new
  vulnerable package/advisory in the complete tree, or expiry of a specifically
  reviewed build-tool exception.
- The quality workflow runs the dependency audit before type checks, tests and
  the production build.
- Dependabot checks npm and GitHub Actions weekly. Minor and patch updates are
  grouped separately from major updates.
- The quality workflow has read-only repository permission and receives no
  commerce or deployment secrets.

An audit result is a triage signal, not proof that the application is secure.
It does not cover the operating system, managed database, Render base image,
Cloudflare service, browser extensions or external providers.

## Dependency update procedure

1. Review the package or action's official changelog, security advisory,
   maintenance status and required runtime version.
2. Identify whether it executes in the browser, build pipeline, customer
   runtime, operations runtime or database tooling.
3. Reject an update that introduces an unnecessary dependency, telemetry,
   post-install side effect, new secret requirement or expanded network access.
4. For a major update, document the migration and rollback impact; do not merge
   it as part of an unrelated change.
5. Run `npm ci`, `npm run check`, `npm run test:commerce`,
   `npm run test:staging-monitor`, `npm run test:customer-route-gates`,
   `npm run test:database-restore`, `npm run audit:commerce-security` and
   `npm run build`.
6. Review the lockfile diff for an unexpected package, registry, resolved source
   or lifecycle change.
7. Merge only after the normal review and quality workflow pass. Deploy through
   the source-controlled path and preserve the last known-good commit for
   rollback.

Dependabot must never be configured to auto-merge commerce dependency updates.

## Vulnerability triage

For each alert, record a privacy-safe advisory reference, affected package and
version, reachable component, severity, exploit conditions, decision owner and
target date. Do not include secrets, vulnerable endpoint details that would aid
abuse, or customer records in a public issue.

| Situation | Required action |
| --- | --- |
| Critical or known exploitation affecting a reachable runtime | Disable or isolate the affected capability, begin incident handling and apply a reviewed fix or mitigation immediately. |
| High vulnerability affecting a reachable runtime | Block release and prioritise a tested upgrade, patch or compensating control. |
| Moderate production vulnerability | Block release until fixed or an accountable security owner records a time-bounded exception. |
| Build-only or unreachable vulnerability | Confirm the reachability analysis, limit CI permissions and record the remediation decision. |
| No upstream fix | Remove/replace the dependency or document a time-bounded compensating control and monitoring plan. |

If personal data, credentials or payment integrity may have been affected,
follow `PERSONAL-DATA-INCIDENT-ESCALATION.md` and the relevant commerce outage
runbook rather than treating the alert as a routine upgrade.

## Runtime and platform review

Before production and after a material platform change:

- confirm GitHub Actions and both Render services use the approved Node.js major
  version and a currently supported patch release;
- confirm the Render build and start commands match the committed runbooks;
- review the Render deployment for an unexpected package-install script,
  executable or outbound service;
- review PostgreSQL major/minor support, maintenance notices and extensions;
- review Cloudflare, Render, payment and fulfilment provider security notices;
- confirm every service still has only the required environment variables and
  permissions;
- run the full quality workflow and staging health/readiness checks after the
  update;
- record reviewer, date, deployed commit and any accepted residual risk.

## Exception rule

An audit bypass must be specific, time-limited and approved by the accountable
security owner. Record the advisory, affected version, reachability evidence,
compensating control, expiry date and upgrade owner. Do not reduce the global
audit threshold to make one alert pass.

## Current evidence and remaining gates

On **7 September 2026**, the production dependency audit reported zero known
vulnerabilities. The complete audit reported four high-severity `fast-uri`
advisories propagated through the development-only `@astrojs/check` language
server chain. No upstream fix was available. The affected chain is not installed
by `npm ci --omit=dev` and does not execute in the customer or operations
runtime.

A narrowly matched exception accepts only the eight reported build-chain
package entries and four advisory URLs. It expires on **8 October 2026**, fails
for any new advisory/package or production finding, and must be removed earlier
if an upstream fix becomes available. This is a time-bounded engineering
assessment, not a general waiver of high-severity findings.

The following remain launch gates:

- [ ] Review the first Dependabot npm and GitHub Actions pull requests.
- [ ] Upgrade the Astro check chain when a `fast-uri` fix is available and
      remove the temporary exception no later than 8 October 2026.
- [ ] Review deployed Render runtime and PostgreSQL maintenance configuration.
- [ ] Assign an accountable security owner and exception approver.
- [ ] Define a response target and backup owner for urgent alerts.
- [ ] Repeat the audit and runtime review immediately before production launch.
