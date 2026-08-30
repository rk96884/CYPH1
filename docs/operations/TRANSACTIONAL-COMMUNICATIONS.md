# Transactional communications

Commerce order messages are separate from marketing communications and do not depend on marketing consent. The initial provider is a no-send `manual-test` adapter; live delivery remains disabled until a provider and credentials are explicitly approved.

## Event mapping

- `payment.paid` → order confirmation
- `fulfilment.dispatched` → dispatch confirmation
- `payment.cancelled` or `fulfilment.cancelled` → cancellation confirmation
- `refund.completed` → refund confirmation

`communication_deliveries` is an independent subscriber ledger over the transactional outbox. Its semantic deduplication keys prevent duplicate sends without competing with fulfilment's outbox processing status. Recipient email is resolved from the order's customer record and is not copied into this ledger.

## Safe enablement

Keep communications disabled in every environment by default. A worker may construct `TransactionalCommunicationConsumer` with `enabled: true` only in an isolated test environment using `ManualTestCommunicationProvider`. A future live provider must honour the supplied idempotency key, authenticate its webhooks where applicable, avoid marketing content and preserve the four approved template purposes.

Apply migration `0007_transactional_communications.sql`, then run `npm run db:migrate` and `npm run db:verify` against the intended database.
