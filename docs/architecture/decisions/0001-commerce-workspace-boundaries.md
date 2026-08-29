# ADR 0001: Commerce workspace boundaries

**Status:** Accepted  
**Date:** 29 August 2026

## Context

The existing Astro pre-launch website will evolve into the CYPH/1 storefront. Commerce requires server-side code and a provider-independent domain without forcing an early decision on the API runtime, database or payment SDK.

## Decision

- Keep the Astro website at the repository root.
- Use npm workspaces for `apps/*` and `packages/*`.
- Reserve `apps/commerce-api` for server-side orchestration.
- Reserve `packages/commerce-core` for pure domain rules with no framework, database or provider dependency.
- Introduce no API framework, database driver or payment SDK in the boundary scaffold.
- Make every commerce and fulfilment feature fail closed by default.

## Consequences

- The public site remains deployable exactly as it is today.
- Domain rules can be tested independently of hosting and providers.
- A runtime/database ADR is still required before persistence or HTTP routes are implemented.
- npm workspace metadata becomes part of the root lockfile.
