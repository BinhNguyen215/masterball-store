# Backup and restore

## Safety boundary

Production migration and large catalog import require a verified backup first. `scripts/migrate-database.ts` enforces a production backup reference but cannot prove the artifact is restorable; the operator owns that verification.

Never restore into production as a rehearsal. Use a new isolated database with credentials that cannot access production.

## Before a production change

1. Resolve and record the exact database host/name. Stop if it is ambiguous.
2. Create an encrypted provider snapshot or a PostgreSQL custom-format dump with `pg_dump`. Store it outside the repository under the approved retention policy.
3. Verify the snapshot is complete or run `pg_restore --list` against the dump. Record the artifact identifier, timestamp, source database, tool version, encryption location, and operator.
4. Set `MIGRATION_BACKUP_REFERENCE` to that identifier for the migration job, run `pnpm db:migrate`, then remove the variable from ad-hoc shells.
5. Reconcile migration state plus order, payment, active reservation, and inventory totals before enabling writes.

## Restore rehearsal

1. Provision an empty disposable PostgreSQL database in the same major version.
2. Restore the selected snapshot/dump into that target and apply only the application release compatible with it.
3. Run schema, auth, catalog, order lookup, payment-event, reservation, inventory-ledger, and tournament read checks. Verify object keys referenced by media records still resolve.
4. Record measured restore time and the newest restored transaction timestamp as RTO/RPO evidence.
5. Destroy the rehearsal database after evidence review according to the test-data retention policy.

## Production restore

Restoration is an incident action, not a routine rollback. Freeze writes, preserve the failed state, obtain approval for the measured data-loss window, restore to a new target where possible, reconcile domain invariants, switch traffic deliberately, and keep the prior target isolated until the incident is closed.
