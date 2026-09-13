# Customer staging source rollback rehearsal

**Exercise:** `CDR-DRILL-002`  
**Date:** 13 September 2026  
**Outcome:** Passed for a benign source-controlled revert  
**Scope:** Customer staging runtime; checkout, payment webhooks, payments and fulfilment remained disabled

## Objective and safety boundary

Demonstrate that an observable, non-functional customer runtime change can be
deployed and then removed through a new `git revert` commit, without rewriting
`main` or changing database state or commerce enablement. The temporary marker
was an `X-CYPH1-Rollback-Drill` header on `GET /health`; it did not alter the
status code or JSON body.

No checkout or webhook request was submitted. The route-gate verifier sent
read-only `GET` requests. This exercise does not demonstrate recovery from a
faulty release, an in-flight payment, a schema change or a database restore.

## Evidence

| Check | Recorded result |
| --- | --- |
| Last known-good source | `f6d9d63` |
| Temporary marker commit | `1c60da8` |
| Marker deploy | Customer staging manual Render deployment recorded at 15:14:03 UTC; logs showed Live by 15:14:51 UTC |
| Marker visibility | `GET /health` returned HTTP `200`, `{"status":"ok"}` and `X-CYPH1-Rollback-Drill: CDR-DRILL-002` |
| Marker-deploy route gates | `/checkout` HTTP `404`; `/webhooks/mollie` HTTP `404`; exact disabled mode verified |
| Source-controlled revert | `f77abf3` reverted `1c60da8` without resetting or force-pushing `main` |
| Revert deploy | Customer staging manual Render deployment recorded at 15:20:19 UTC; logs showed Live by 15:21:11 UTC |
| Revert visibility | `GET /health` returned HTTP `200` and `{"status":"ok"}`; the drill header was absent |
| Revert-deploy route gates | `/checkout` HTTP `404`; `/webhooks/mollie` HTTP `404`; exact disabled mode verified |
| Post-revert monitoring | Commerce staging monitor run `#95` passed for customer and operations health/readiness |
| Database or configuration changes | None performed for this drill |

The repository history shows the revert removed only the temporary marker and
its focused test. Commerce route exposure and the protected operations service
were not modified by either drill commit.

## Remaining launch gates

- Test actual checkout containment while retaining verified Mollie test webhook
  processing for an in-flight synthetic payment, once the reviewed sandbox
  account is available.
- Rehearse a compatible faulty-release rollback and recovery decision under an
  approved incident scenario. This benign marker proves the deployment path,
  not incident diagnosis or data compatibility.
- Obtain accountable production approval. This staging result does not enable
  public checkout or live payments.
