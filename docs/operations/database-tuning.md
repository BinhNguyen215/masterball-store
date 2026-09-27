# Database tuning notes

Records what the data layer relies on so an operator can change it safely. The
schema itself is owned by `src/db/schema/`; migrations by `drizzle/`.

## Indexes added for the queries that actually run

| Purpose | Index |
| --- | --- |
| Public catalog search (`ILIKE '%q%'` on title/slug/SKU) | `products_title_trgm_idx`, `products_slug_trgm_idx`, `product_variants_sku_trgm_idx` (GIN, `pg_trgm`) |
| Admin search by order number / recipient / phone | `orders` and `order_addresses` trigram indexes; `payments_reference_trgm_idx`, `payments_transaction_trgm_idx` |
| Admin audit search | `audit_logs_action_trgm_idx`, `audit_logs_subject_id_trgm_idx` |
| Reservation expiry sweep | `orders_reservation_expiry_idx` (partial: `PENDING_PAYMENT` + `PENDING`) |
| Admin lists ordered by recency | `orders_created_idx`, `payments_created_idx`, `audit_logs_created_idx`, `products_admin_updated_idx`, `tournaments_updated_idx`, `inventories_updated_idx` |
| Sitemap and featured ordering | `products_active_slug_idx`, `products_active_featured_idx` (partial on `status = 'ACTIVE'`) |
| Availability filter | `inventories_available_expr_idx` on `(on_hand - reserved)` |
| Stale outbox claim | `email_outbox_processing_idx` (partial on `status = 'PROCESSING'`) |

`pg_trgm` is created by migration `0001`. Trigram indexes only help because the
search predicates keep the leading `%`; a btree on the same column cannot.

## Invariants the database now enforces

`orders` (payment method ⇒ reservation window, cancellation/completion
timestamps, order-number format, `total = subtotal + shipping - discount`,
discount bounds and coupon coupling), `payments` (`PAID ⇒ paid_at`),
`inventory_reservations` (`RELEASED`/`COMMITTED ⇒` timestamp), `tournaments`
(`cancelled ⇒ cancelled_at`), `products` (`ACTIVE ⇒ published_at`), `coupons`
(value ranges, usage ceiling, window order, uppercase code), `product_reviews`
(rating, author, body, `PUBLISHED ⇒ published_at`),
`tournament_registrations` (phone format, status timestamps, one seat per phone
per event), `restock_alerts` (lowercase email, one alert per address per
variant), plus `user_email_lower_unique` so staff emails are unique
case-insensitively.

## Applying index DDL on a live database

`scripts/migrate-database.ts` runs drizzle's migrator, which wraps **all pending
migrations in one transaction**. `CREATE INDEX CONCURRENTLY` cannot run inside a
transaction, so a large index added through the normal path takes a `SHARE` lock
and blocks writes for the build. On a table that must stay writable (`orders`,
`inventory_movements`, `audit_logs`) apply the same statement out of band with
`psql` using `CONCURRENTLY`, then record it in `drizzle/` so the snapshots agree.

Remote databases still require `MIGRATION_BACKUP_REFERENCE` (see
[backup and restore](backup-restore.md)); the gate keys on the database target,
not on `NODE_ENV`.

## Deliberate trade-offs

- **Admin list totals are a lower bound.** Each list counts at most one row past
  the requested page, so the panel never scans a whole table for a number it
  only uses to offer "next". The pagination label therefore shows the current
  page without a total page count.
- **Unbounded-growth tables have no retention policy**: `audit_logs`,
  `inventory_movements`, `payment_events`, `email_outbox`, `rateLimit`, `carts`.
  Audit and financial records need an archival decision, not a delete job.
- **Money columns are `integer` (int4)**: safe up to 2,147,483,647 VND per
  column. Moving to `bigint` is a table rewrite and must be staged.
- **Denormalised counters** (`inventories.on_hand`/`reserved`,
  `coupons.used_count`, `orders.version`) are written under row locks, but
  `inventory_movements` is never compared against `inventories`; there is no
  reconciler.
- **Reservation release cadence.** `vercel.json` schedules the expiry job daily
  because the Hobby plan only allows daily crons, so an abandoned online-payment
  reservation can hold stock for up to a day. Raise the cadence on Pro or call
  `POST /api/jobs/release-expired` from an external scheduler.
