# Database interruption and runtime recovery

**Status:** Local failure-transition baseline complete; managed staging exercise deferred  
**Last engineering update:** 7 September 2026

## Purpose

Prove that a temporary PostgreSQL failure makes dependency readiness fail closed
without presenting the runtime process as dead, and that readiness can recover
after connectivity returns without requiring application state to be manually
edited.

This procedure does not replace backup restoration. Logical restore and Render
point-in-time recovery are covered by
`DATABASE-BACKUP-AND-RESTORE-REHEARSAL.md`.

## Expected runtime behaviour

| Condition | `/health` | `/ready` | Operator interpretation |
| --- | --- | --- | --- |
| Runtime and database available | `200 {"status":"ok"}` | `200 {"status":"ready"}` | Service may receive traffic permitted by its independent route gates. |
| Runtime available, database unavailable | `200 {"status":"ok"}` | `503 {"status":"unavailable"}` | Process is alive but must not be considered ready for database-dependent work. |
| Database connectivity restored | `200 {"status":"ok"}` | Returns to `200 {"status":"ready"}` | Revalidate schema and transaction integrity before resuming mutations. |
| Runtime unavailable | Connection failure or non-`200` | Connection failure or non-`200` | Treat as a runtime/deployment incident, not only a database incident. |

Responses remain generic and must not disclose database hosts, credentials,
driver errors, queries or schema details.

## Automated failure transition

The customer and operations runtime tests each exercise:

1. successful readiness;
2. an injected readiness dependency failure;
3. continuing process liveness during that failure; and
4. successful readiness on a later request after the dependency recovers.

Run:

```powershell
npm run test:commerce
```

The tests use in-memory failure injection and never connect to Render or a real
database. They prove request-level state transitions, not PostgreSQL driver,
network, pool or platform recovery.

## Managed staging exercise — deferred

Do not suspend, restart, delete, rotate or alter the current development
database merely to execute this issue. The first managed exercise should use an
isolated paid staging database or another approved disposable target with a
verified recovery point.

Before beginning:

- approve an interruption window and responsible operator;
- record the application and database plans, deployed commit and UTC start;
- verify a usable backup/restore point and a rollback path;
- keep checkout and live provider integrations disabled;
- use synthetic records only;
- confirm GitHub, Render and database alert channels are monitored.

Exercise sequence:

1. Capture healthy customer and operations `/health` and `/ready` responses.
2. Introduce a reversible database connectivity interruption at the isolated
   target without changing schema or deleting data.
3. Confirm both runtimes retain `200` liveness and return generic `503`
   readiness. Record alert delivery and correlation timestamps, not secrets or
   raw connection errors.
4. Restore connectivity. Do not manually modify application records.
5. Confirm readiness returns to the exact `200` response without a runtime
   restart. If it does not, capture the condition before an approved restart.
6. Run migration and schema verification, then compare the synthetic record
   invariants defined by the restore-verification runbook.
7. Run the standard commerce staging monitor and retain its outcome.
8. Confirm no duplicate order, payment, refund, fulfilment or communication
   event was created during recovery.

Stop and escalate if liveness also fails, readiness exposes diagnostics,
connectivity does not recover, migrations differ, or record/event invariants do
not match.

## Evidence record

| Field | Record |
| --- | --- |
| Reviewer and incident owner | |
| Commit and environment | |
| Database and runtime plans | Deferred |
| UTC interruption/recovery interval | Deferred |
| Backup or recovery point | Deferred |
| Health/readiness transitions | Automated local baseline passed; managed evidence deferred |
| Alert delivery | Deferred |
| Schema and synthetic invariant verification | Deferred |
| Restart required | Deferred |
| Follow-up | Repeat against an isolated paid staging database before production approval |
