-- Schema preparation only. DO NOT apply to production without separate authorization.
-- Add a per-claim fencing token to the existing payment fulfilment outbox.
-- Additive, nullable: no data backfill. Previous claims have NULL tokens and
-- must not be completed by the new consumer after migration.
BEGIN;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claim_token uuid;
COMMIT;
