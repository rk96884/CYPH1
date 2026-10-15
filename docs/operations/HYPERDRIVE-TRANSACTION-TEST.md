# Hyperdrive synthetic transaction test — preparation only

PR #150 adds a **separate manual-only** test using the existing `cyph1-hyperdrive-development` binding. The test uses two PostgreSQL connections, checks `FOR UPDATE SKIP LOCKED` under overlapping transactions, and deliberately **rolls back** its status update. It never invokes Brevo, order/fulfilment code, commerce payments or production DB connections. It records only sanitized outcome and rough wall-clock duration; Cloudflare's actual CPU time must be read from Cloudflare's metrics.

The isolated table currently has **zero rows**. Before a live test, obtain separate approval to run `prototypes/cloudflare-commerce-cron/sql/development-probe-seed.sql` through authenticated development PSQL to insert two synthetic rows. The SQL fails closed outside `cyph1_commerce_development`. Do not seed or run the live transaction probe until the owner approves the write.

The normal read-only Hyperdrive probe retains its own marker and flag. The transaction probe requires **its own** environment variable `HYPERDRIVE_TRANSACTION_PROBE_ENABLED=true` and event marker `__manual_hyperdrive_transaction_test__`; the default is disabled. No Cron triggers are registered. The test is intended to be run **once** in Wrangler remote dev after merge, explicit seed approval and a guarded check of endpoint support. Stop Wrangler immediately afterwards.

CI uses mocks only and the existing Wrangler dry-run. Passing CI does not establish live concurrency safety or free-tier CPU viability.
