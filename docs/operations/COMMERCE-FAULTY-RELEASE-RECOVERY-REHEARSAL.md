# Customer staging faulty-release recovery rehearsal

**Exercise:** `CDR-DRILL-003`  
**Date:** 15 September 2026  
**Outcome:** Passed  
**Scope:** Customer staging runtime only; checkout, payment webhooks, payments and fulfilment remained disabled

## Objective and safety boundary

Demonstrate that a compatible but observably faulty customer-runtime release is
detected and recovered using a source-controlled revert. The temporary release
changed only the generic `GET /health` JSON from `{"status":"ok"}` to
`{"status":"degraded"}` while retaining HTTP `200`. This allowed Render to run
the revision while the exact-response GitHub monitor detected the fault.

The exercise did not change the database, issue a checkout request, submit a
webhook, contact a payment or fulfilment provider, rewrite branch history or
deploy to production. The disabled route-gate verification continued to require
HTTP `404` from both `/checkout` and `/webhooks/mollie`.

## Evidence

| Check | Recorded result |
| --- | --- |
| Last known-good commit | `d2d597a` |
| Temporary faulty-release commit | `36b79a2` |
| Fault deployment | Existing committed revision `36b79a2` was manually deployed to customer staging only |
| Injected health result | `GET /health` returned HTTP `200` with `{"status":"degraded"}` |
| Fault monitor | Run `#107` failed as expected at 12:55 UTC; only `customer-health-and-readiness` failed |
| Operations isolation | `operations-health-and-readiness` passed in run `#107` |
| Fault-deploy route gates | Checkout HTTP `404`; payment webhook HTTP `404`; disabled mode verified |
| Source-controlled recovery | Revert commit `e1d4460` reverted `36b79a2` without branch rewriting |
| Recovery deployment | `e1d4460` was manually deployed successfully to customer staging |
| Recovered health/readiness | `/health` returned HTTP `200` with `{"status":"ok"}`; `/ready` returned HTTP `200` with `{"status":"ready"}` |
| Final dual-runtime monitor | Run `#108` passed both jobs at 12:59 UTC |
| Database/configuration/provider changes | None |

GitHub Actions used the current `main` workflow revision `e1d4460`; the customer
runtime itself was deliberately moved between the existing committed application
revisions during the bounded deployment test. No `simulate_failure` workflow
input was used.

## Result and remaining boundary

The exercise proved that an exact application-health contract regression is
visible independently from Render's process-level deployment success, that the
dual-runtime monitor identifies the affected customer service without failing
the operations service, and that the last source-controlled behaviour can be
restored without a reset or force-push.

This result does not test database migration rollback, an in-flight payment,
Mollie webhook continuity or production approval. Those remain separate launch
gates.
