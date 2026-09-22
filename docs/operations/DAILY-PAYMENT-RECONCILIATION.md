# Daily payment, order and refund reconciliation

**Status:** Pre-production engineering baseline; sandbox reconciliation exercise passed on 22 September 2026; finance approval and production ownership outstanding

**Scope:** Provider payments/refunds compared with CYPH/1 orders, checkout sessions and fulfilment state

## Control objective

Every provider payment and refund must have one explainable local record with
the same provider reference, currency, amount and final state. Every locally
captured payment must exist at the provider. Fulfilment must not proceed from a
browser redirect, email, bank deposit or dashboard observation alone.

This procedure does not approve live commerce, VAT treatment, bookkeeping or
settlement accounting. Those remain accountable launch gates.

## Ownership and frequency

- The holder of `reconciliation:export` performs the check through the
  Cloudflare Access-protected operations service.
- A different authorised person should review material exceptions when staffing
  permits. Until then, the project owner records both performance and review.
- Run once each working day during test activity and before/after every controlled
  payment exercise. Define production cut-off time, weekends and holiday cover
  before launch.
- Use UTC for the export interval and evidence record. Provider settlement dates
  may follow a different business-day calendar and must not be conflated with
  payment creation dates.

## Sources

1. Mollie test dashboard or authorised provider export/API data.
2. CYPH/1 protected reconciliation CSV.
3. Protected order timeline for each exception.
4. Render request events and webhook evidence only when an exception needs
   investigation.

Do not reconcile from the customer-facing status page. Do not use the bank
statement as the only payment-level source; settlement reconciliation is a
separate finance control.

## Generate the CYPH/1 export

1. Sign in to the protected operations page using the named operator identity.
2. Select a UTC `from` value (inclusive) and `to` value (exclusive). The API
   rejects invalid intervals and ranges longer than 31 days.
3. Download `cyph1-reconciliation.csv` and retain it only in an approved,
   access-restricted location.
4. Confirm the file has no more than 5,000 rows. A 5,000-row result may be
   truncated; split the time interval and repeat rather than treating it as
   complete.
5. Confirm expected columns are present. The export intentionally excludes
   names, emails, delivery addresses and payment credentials.

The authoritative column allowlist and handling boundary are documented in
`LOGGING-AND-EXPORT-DATA-BOUNDARIES.md`.

The interval includes an order when its order, any payment attempt, or any refund
was created during the selected window. Each payment attempt is a separate row.
An order without a payment is retained so failed or ambiguous checkout creation
cannot disappear from reconciliation.

## Match rules

For every provider payment in the interval, match:

- `provider` and `provider_payment_id`;
- provider amount against `amount_minor` and `currency` (minor units);
- provider state against `payment_status` and `order_status`;
- completed provider refunds against `refunded_minor`;
- pending or created refunds against `open_refund_minor`;
- ambiguous refunds against `resolution_required_refund_minor`;
- checkout exceptions against `checkout_state` and
  `checkout_failure_code`.

Then confirm:

- captured payments have the expected paid order state;
- unfulfilled/queued fulfilment is explainable and no unpaid order progressed;
- completed refunds do not exceed the captured amount;
- failed/cancelled refund totals are investigated but are not counted as money
  returned;
- each provider payment reference occurs only once locally;
- every `resolution_required` value has an owner and next review time.

## Exception classes

| Code | Condition | Required action |
| --- | --- | --- |
| `P1` | Provider payment has no local payment/order | Stop checkout and fulfilment; escalate urgently |
| `P2` | Local captured payment is absent or differs at provider | Keep fulfilment blocked; retrieve authoritative provider state |
| `P3` | Amount or currency mismatch | Do not fulfil/refund; escalate and preserve evidence |
| `P4` | Duplicate provider or local payment reference | Stop related processing; investigate idempotency and webhook history |
| `R1` | Completed refund amount/status mismatch | Block further refund; reconcile through provider workflow |
| `R2` | Open or `resolution_required` refund | Do not retry; follow the ambiguous-payment runbook |
| `C1` | Checkout session is `resolution_required` | Do not create a replacement attempt until provider absence/existence is proven |
| `W1` | Failed/unverified webhook left state stale | Keep webhook route available; investigate verification and safe replay |
| `F1` | Fulfilment advanced without a reconciled captured payment | Stop fulfilment and escalate urgently |

Never correct an exception by editing database rows, deleting events or changing
the CSV. Use an audited application/provider operation or an engineering-reviewed
fix.

## Daily close

The reconciliation is complete only when:

1. Every provider payment/refund in scope is matched or logged as an exception.
2. Every local payment/refund in scope is matched to authoritative provider
   state.
3. All exceptions have a code, owner, opened-at time, evidence reference and next
   action/review time.
4. The opening and closing counts and amounts by currency balance.
5. No unexplained `resolution_required`, unmatched capture, unsafe fulfilment or
   duplicate reference remains.
6. The operator records completion time and reviewer role without copying
   personal or payment data into source control.

An unresolved exception does not prevent the control from being performed, but
it prevents a clean close. Critical exceptions require checkout containment.

## Privacy-safe evidence template

```text
Environment:
UTC interval [from, to):
Operator role:
Reviewer role:
Local row count:
Provider payment count / total by currency:
Local payment count / total by currency:
Provider completed-refund count / total by currency:
Local completed-refund count / total by currency:
Exceptions by code:
Exception references (non-personal IDs only):
Result: balanced | open exceptions | contained
Completed at UTC:
Next review at UTC (if applicable):
```

Do not store customer identity/address data, API keys, access assertions, card
details, raw webhook bodies or complete provider payloads in the evidence note.

## Required sandbox exercise

When the reviewed Mollie test organisation and `test_` key are available:

1. Export a window containing one successful synthetic payment and match it to
   Mollie.
2. Repeat after a completed synthetic refund and verify the completed amount.
3. Create the approved ambiguous checkout/refund scenarios and confirm they are
   surfaced by the CSV rather than silently balanced.
4. Confirm an order without a provider payment remains visible.
5. Record privacy-safe evidence, remove the local export from unapproved storage,
   and return all staging commerce gates to `false`.

Follow `PAYMENT-PROVIDER-OUTAGE.md` for ambiguous outcomes and
`COMMERCE-DISABLE-AND-ROLLBACK.md` for containment.


## Sandbox reconciliation evidence — 22 September 2026

The engineering sandbox exercise passed using two complementary evidence sets while commerce remained in the locked fail-closed baseline.

A protected reconciliation export for the UTC interval 21–23 September contained seven rows and surfaced the existing synthetic payment activity without exposing customer names, email addresses, delivery addresses or payment credentials. The export included the current £2 control order as order `paid`, payment `captured`, fulfilment `unfulfilled` and £0 refunded; five earlier £2 attempts as payment `expired` with orders `pending_payment` and fulfilment `unfulfilled`; and the earlier fully refunded £2 transaction because refund activity fell inside the selected interval. That row showed the captured £2 fully refunded through two completed £1 refund records with no fulfilment.

The remaining exception-visibility controls were exercised by the guarded, manual-only rollback rehearsal introduced in PR #30 and run from `main` commit `7b26482`. GitHub Actions run `35748889741` passed on 22 September 2026. Inside one non-production database transaction the rehearsal created synthetic-only records and verified that reconciliation semantics surface a checkout in `resolution_required` with `ambiguous_provider_outcome`, a 700-minor-unit refund in `resolution_required`, and an order with no provider payment. The transaction was rolled back and the rehearsal verified cleanup. No Mollie call was made and no customer identity was emitted by the rehearsal.

This closes the engineering sandbox reconciliation exercise. Finance approval, production cut-off/coverage, named production ownership, settlement/accounting controls and production operational approval remain launch gates.
