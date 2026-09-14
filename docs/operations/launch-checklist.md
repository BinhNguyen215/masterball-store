# Launch checklist

Production launch is blocked until every applicable item has an owner and evidence.

## Business and content

- [ ] Store identity, contact details, selling entity, invoice/tax handling, privacy/cookie notice, terms, shipping, cancellation, and return policy are approved by the shop's legal/accounting owner.
- [ ] Product catalog, prices, stock, images, alt text, and tournament content are supplied or approved by the shop; asset usage rights are recorded outside the repository.
- [ ] The initial CSV import was dry-run, reviewed, backed up, applied transactionally, and reconciled against physical stock.

## Platform and security

- [ ] Production database, object storage, email, auth, VNPAY, and cron credentials are separate from non-production and stored in the deployment secret manager.
- [ ] The owner bootstrap completed once; `OWNER_*` variables were removed immediately; every staff role was tested against `src/modules/auth/roles.ts`.
- [ ] Secret scan, dependency audit, security-header check, upload validation, authorization/IDOR checks, and staff offboarding rehearsal passed without unresolved Critical or High findings.
- [ ] Review `GHSA-67mh-4wv8-2f99` in the Drizzle tooling dependency chain; upgrade/remove the affected development loader when upstream permits, or record a named owner, deadline, and explicit acceptance before launch. Never expose a development server to untrusted networks.

## Commerce evidence

- [ ] VNPAY sandbox evidence covers success, cancel, expiry, duplicate/out-of-order IPN, invalid signature, amount mismatch, and valid payment after inventory release.
- [ ] COD cancellation, stock release, fulfillment, tracking, and email retry flows passed UAT.
- [ ] Concurrent purchase of the final item was verified against a disposable PostgreSQL database with exactly one successful reservation.

## Recovery and release

- [ ] The [backup and restore procedure](backup-restore.md) was rehearsed, with measured RPO/RTO and reconciled order/inventory totals.
- [ ] CI gates in `.github/workflows/ci.yml` pass on the release revision; responsive keyboard and screen-reader checks pass on critical public/admin flows.
- [ ] An operator owns payment exceptions, orders, inventory corrections, and incidents during the first 48 hours.
- [ ] Rollback thresholds and the [incident runbook](incident-runbook.md) are available to the on-call operator.
