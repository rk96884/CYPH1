-- REVIEW-ONLY. Do NOT execute without separate approval.
-- Production DB role: cyph1_hyperdrive_prod_worker.
-- These grants apply only to the existing bounded communications and
-- automatic manual-live fulfilment consumers, not the operations UI.
-- No blanket table grants and no production activation.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cyph1_commerce_production'
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cyph1_hyperdrive_prod_worker' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole)
  THEN RAISE EXCEPTION 'Unexpected database or Hyperdrive role'; END IF;
END $guard$;
GRANT CONNECT ON DATABASE cyph1_commerce_production TO cyph1_hyperdrive_prod_worker;
GRANT USAGE ON SCHEMA public TO cyph1_hyperdrive_prod_worker;

-- Read-only source objects for consumer decision-making.
GRANT SELECT ON TABLE public.orders, public.order_items, public.customers,
  public.payments, public.products, public.refunds,
  public.inpost_collection_reviews TO cyph1_hyperdrive_prod_worker;

-- Outbox: claim and complete payment.paid events; also read email event sources.
GRANT SELECT ON TABLE public.outbox_events TO cyph1_hyperdrive_prod_worker;
GRANT UPDATE(processing_status, attempt_count, processing_started_at,
  last_error_code, available_at, published_at, claim_token)
  ON public.outbox_events TO cyph1_hyperdrive_prod_worker;
-- The fulfilment repository creates fulfilment event records for provider events;
-- manual-live create path only inserts reservation and audit records.
GRANT SELECT ON TABLE public.communication_deliveries TO cyph1_hyperdrive_prod_worker;
GRANT INSERT(source_event_id, order_id, customer_id, template_key,
  deduplication_key, status, attempt_count, processing_started_at, claim_token)
  ON public.communication_deliveries TO cyph1_hyperdrive_prod_worker;
GRANT UPDATE(status, last_error_code, claim_token, processing_started_at,
  updated_at, terminal_failure, attempt_count, send_started_at,
  provider, provider_reference, sent_at, available_at)
  ON public.communication_deliveries TO cyph1_hyperdrive_prod_worker;

GRANT SELECT ON TABLE public.fulfilments TO cyph1_hyperdrive_prod_worker;
GRANT INSERT(order_id, provider, status, idempotency_key, request_snapshot)
  ON public.fulfilments TO cyph1_hyperdrive_prod_worker;
GRANT UPDATE(status, failure_code, provider_reference)
  ON public.fulfilments TO cyph1_hyperdrive_prod_worker;

GRANT UPDATE(fulfilment_status) ON public.orders TO cyph1_hyperdrive_prod_worker;
GRANT INSERT(entity_type, entity_id, action, actor_type, correlation_id, change_summary)
  ON public.audit_events TO cyph1_hyperdrive_prod_worker;

-- No TRUNCATE, DELETE, CREATE, sequences, all-tables, or default privileges.
COMMIT;
