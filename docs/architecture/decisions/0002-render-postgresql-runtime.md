# ADR 0002: Render PostgreSQL runtime

**Status:** Accepted for initial implementation  
**Date:** 29 August 2026

## Context

CYPH/1 needs a relational database for catalogue, inventory, customers, orders,
payments, refunds, webhook processing and audit records. The first release is
expected to have low traffic, but the data is operationally and financially
important. The database therefore needs managed recovery, encrypted
connections, predictable upgrades and a straightforward path to increased
capacity.

The project owner already operates a Render Hobby workspace. Render, Neon,
Heroku, Railway, DigitalOcean, Supabase and Aiven were compared for initial
cost, recovery, connection management, region availability and operational
overhead.

## Decision

Use a paid Render Postgres instance in the existing Render Hobby workspace for
the initial commerce implementation.

- Use PostgreSQL 17 unless a supported dependency requires another version.
- Use the `0.5c-1g` compute plan (formerly Basic 1 GB) as the minimum production
  size.
- Place the commerce API and database in Render's Frankfurt region.
- Connect from the commerce API using Render's private/internal database URL.
- Keep development, preview and production data logically and operationally
  separate.
- Use versioned SQL migrations committed to the repository.
- Use Render point-in-time recovery and create an encrypted nightly logical
  export outside Render before accepting production orders.
- Keep checkout and payment processing disabled until the commerce launch gate
  is approved.

The database connection string is a secret. It must be supplied as
`DATABASE_URL` through Render environment configuration and must never be
committed or exposed to browser code.

## Why this option

Render provides the required managed PostgreSQL service, private networking,
TLS, point-in-time recovery and a simple upgrade path without adding another
vendor account. The Hobby workspace is sufficient for a single operator and
the initial service count. A paid database is required; Render's free database
is not suitable for commerce because it has no managed recovery and expires.

The Hobby workspace provides a three-day point-in-time recovery window. This is
acceptable for the controlled initial phase when combined with independent
logical exports. A longer recovery window, additional operators or stronger
workspace controls would trigger a review of Render Pro or an alternative
database service.

## Consequences

- The API and database should remain colocated in Frankfurt to avoid public
  network latency and unnecessary exposure.
- The public Astro site may be hosted elsewhere; browsers must communicate with
  the commerce API rather than the database.
- Production availability depends on the selected paid database and API compute
  plans, not merely on the Hobby workspace subscription.
- The initial database will not have high availability. Operational procedures
  must tolerate a short outage and protect against duplicate payment or
  fulfilment processing when service resumes.
- Frankfurt provides EU rather than UK-only data residency. This must be
  reflected in supplier/privacy records and reviewed if UK-only residency
  becomes a requirement.
- Render Hobby supports one workspace member. Upgrade before granting another
  person direct operational access.

## Production readiness gate

Before storing live customer or order data:

1. Confirm the database is a paid `0.5c-1g` instance or larger.
2. Confirm the API and database are both in Frankfurt.
3. Confirm the API uses the internal connection URL with TLS.
4. Apply migrations through a controlled release step, not application startup.
5. Confirm point-in-time recovery is available and perform a restore rehearsal.
6. Configure and test an encrypted off-platform logical backup.
7. Restrict external database access to approved administrative sources.
8. Enable cost, storage, error and connection monitoring.
9. Keep all production commerce and payment feature flags disabled until the
   wider launch gate is signed off.

## Reconsideration triggers

Re-evaluate the decision when any of the following occurs:

- the commerce team requires more than one Render workspace member;
- a seven-day or longer managed recovery window becomes mandatory;
- UK-only data residency becomes a requirement;
- sustained load exceeds the selected compute plan;
- high availability becomes necessary;
- Render bandwidth or database costs materially exceed a comparable managed
  service;
- the commerce API moves permanently to another platform and private Render
  networking no longer provides an advantage.

Neon Launch remains the primary portability candidate because it offers managed
PostgreSQL, pooled serverless connections and a London region. The application
must therefore use standard PostgreSQL features and portable migrations rather
than Render-specific database behaviour.
