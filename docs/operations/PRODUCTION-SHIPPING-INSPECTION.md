# Read-only production shipping inspection

This inspection reports the current shipping zones, destination statuses, shipping methods/rates, and packaging-profile statuses. It **does not** insert, update, activate, migrate or seed anything and never reads customers or orders. It runs inside a PostgreSQL `BEGIN TRANSACTION READ ONLY` transaction, rolled back after its queries.

## Running it

Prefer a one-off, authorised shell or job in a trusted environment already allowed to reach the **production** PostgreSQL database. Use an existing service environment without copying its database credentials elsewhere. Confirm the database/environment name first.

```bash
node apps/commerce-api/scripts/inspect-production-shipping.mjs
```

The utility uses server-only `DATABASE_URL` and `DATABASE_SSL` from its environment; it does not need Mollie credentials or any shipping setup flags. It does not run automatically during builds, deploys or service startup.

If Render offers no permitted shell or one-off job with production database connectivity, **do not** add this to the customer/operations start command or a deployment hook. Instead arrange a temporary, explicitly reviewed private execution path or a read-only database user/client. Do not expose credentials, database URLs or query output with sensitive metadata in screenshots or issues.

## Output and review

JSON sections: `zonesAndCountries`, `methodsAndRates`, and `packagingProfiles`. Each is limited to 500 rows; this limit is explicit and may truncate larger configurations.

Verify UK service and country status, the intended prices (minor GBP units: 399 for tracked home, 259 for InPost Medium, 399 for InPost Large where applicable), dates and versions, and the absence of accidentally active international destinations. Presence of a rate is **not** launch approval.

Do not promote any rows to `active` through this inspection. A separately reviewed, approved, audited production shipping activation is required. Keep checkout and Mollie live payment gates disabled.
