# MasterBall Store

Vietnamese-first storefront and operations console for a single-location TCG shop. The application covers catalog discovery, signed guest carts, checkout, COD/VNPAY payments, order lookup, inventory control, tournament announcements, and capability-based administration.

The visual identity uses an original ink-purple, magenta, steel, and cyan system. Do not add franchise artwork, characters, or marks unless the store can document its right to use them.

## Quick start

Prerequisites: Node.js 22, pnpm 9.14, and an isolated PostgreSQL database.

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and replace every value used by the feature you are running.
3. Apply the generated schema with `pnpm db:migrate`. Production runs are blocked unless `MIGRATION_BACKUP_REFERENCE` identifies a verified backup.
4. Set the one-time `OWNER_*` variables, run `pnpm bootstrap:owner`, then remove those variables.
5. Start the site with `pnpm dev` and open `http://127.0.0.1:3100`.

Public staff registration is disabled. Never commit `.env.local`, database credentials, merchant secrets, or customer data.

## Verification

The executable quality gates live in `package.json` and `.github/workflows/ci.yml`. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before review. Browser smoke tests use `pnpm test:e2e` after installing the Playwright Chromium runtime.

Database-backed integration and concurrency tests must target a disposable test database, never development or production data.

## Project guidance

- [Documentation map](docs/README.md)
- [Architecture decisions](docs/decisions/architecture-decisions.md)
- [Launch checklist](docs/operations/launch-checklist.md)
- [Incident runbook](docs/operations/incident-runbook.md)
- [Backup and restore](docs/operations/backup-restore.md)

The schema is owned by `src/db/schema/`, migrations by `drizzle/`, business rules by `src/modules/`, and HTTP/UI entry points by `src/app/`.
