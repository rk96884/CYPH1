# Commerce logging and export data boundaries

**Status:** Pre-production engineering baseline; deployed retention, processor
and production access approval outstanding

**Scope:** Commerce application request logs and the protected reconciliation
CSV

## Control objective

Operational diagnostics and finance controls must use the minimum data needed
for their purpose. Adding a database field, request detail or provider payload
must not automatically add it to a log or export.

This review does not approve a privacy notice, retention schedule, processor
contract or production access model. Those require accountable legal and
operational approval before launch.

## Structured request logs

The operations runtime permits exactly these fields:

| Field | Purpose |
| --- | --- |
| `timestamp` | UTC event time |
| `level` | Bounded severity |
| `event` | Fixed event name |
| `requestId` | Server-generated correlation value |
| `method` | HTTP method |
| `route` | `health`, `readiness`, `operations` or `unknown` |
| `status` | HTTP response status |
| `outcome` | Bounded result class |
| `durationMs` | Rounded request duration |

The runtime must not log the URL, path, query, request or response body,
headers, cookies, IP address, Cloudflare assertion or identity, email address,
customer/address data, order/payment reference, raw exception, credential or
provider payload. The route classifier deliberately discards identifiers in
paths. Application request logs are not an audit trail or an order record.

Automated tests assert both the exact emitted field set and omission of canary
personal, query and Access values. Any proposed additional field requires a
documented purpose, privacy review and updated regression test before release.

## Reconciliation CSV

The protected export uses this explicit ordered allowlist:

```text
order_number
order_created_at
order_status
fulfilment_status
currency
total_minor
checkout_state
checkout_failure_code
provider
provider_payment_id
payment_created_at
payment_status
amount_minor
refunded_minor
open_refund_minor
resolution_required_refund_minor
failed_refund_minor
refund_count
fulfilment_reference
fulfilment_record_status
```

These are transaction and operational identifiers needed to match orders,
payments, refunds and fulfilment. They can still be commercially sensitive and
must remain behind Cloudflare Access plus the `reconciliation:export`
permission.

The export excludes customer names, emails, telephone numbers, delivery and
billing addresses, Access identities/assertions, card or bank credentials,
request bodies and raw provider payloads. The renderer reads only the allowlist,
so extra repository properties are ignored. Regression coverage supplies
prohibited canary fields and proves they do not appear. Cell values beginning
with spreadsheet formula characters are escaped.

## Handling rules

- Download only for an approved reconciliation task.
- Keep the file in an approved access-restricted location and do not commit it
  to source control or attach it to general-purpose tickets or chats.
- Share only with an authorised finance/reconciliation role.
- Record exceptions using non-personal operational references.
- Delete local copies according to the approved retention schedule once that
  schedule exists; until then, do not accumulate exports.
- Treat an unexpected personal field or credential as a potential data
  incident and follow `PERSONAL-DATA-INCIDENT-ESCALATION.md`.

## Review evidence and outstanding gates

Engineering evidence consists of:

- exact-field request-log tests;
- exact-column and prohibited-field CSV tests;
- bounded date ranges, row limits, permission checks and no-store responses;
- the privacy-minimised staging log sample recorded in
  `COMMERCE-STAGING-OBSERVABILITY.md`.

Before production, an accountable review must still confirm Render and any
forwarded-log processor access, geographic processing, retention and deletion;
Cloudflare and operations-role ownership; export storage and deletion; privacy
documentation; and whether every operational identifier remains necessary.

