# Managed database interruption and recovery rehearsal

**Status:** Passed in Render development  
**Date:** 22 September 2026

## Purpose

Verify that the deployed commerce runtimes fail closed when PostgreSQL becomes unavailable and recover after the managed database returns, without restarting the application services or changing application configuration.

## Scope and safety

The exercise used the Render development PostgreSQL service `cyph1_commerce_development`. Checkout, payment webhooks and live providers remained disabled. The database was suspended and resumed using Render's managed control; it was not deleted, reset, migrated or repointed. No synthetic or real commerce records were written for this exercise.

## Evidence

Before interruption, the customer runtime returned HTTP 200 from both `/health` and `/ready`. A manually triggered dual-runtime staging monitor also passed after one transient timeout was rerun successfully.

While the Render development database was suspended:

- customer `/health` remained HTTP 200 with `{"status":"ok"}`;
- customer `/ready` returned HTTP 503 with `{"status":"unavailable"}`;
- Commerce staging monitor run **#151** failed naturally and reported `customer readiness check returned HTTP 503`. The operations readiness job also failed during the shared database interruption.

After Render reported the database Available again, no customer or operations service restart was performed. Customer `/health` returned HTTP 200 and `/ready` returned HTTP 200 with `{"status":"ready"}`. Commerce staging monitor run **#152** then passed both customer and operations health/readiness jobs.

## Result

The managed development exercise passed the required healthy → unavailable → recovered transition. It demonstrates external outage detection and recovery of the deployed application connection path without a service restart.

This does not constitute a production high-availability, failover, point-in-time recovery or disaster-recovery test. Paid Render PITR, off-platform scheduled backup monitoring, production alert ownership and production recovery approval remain separate launch gates.
