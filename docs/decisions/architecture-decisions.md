# Architecture decisions

## Status

Accepted for the first production-capable release. Changes to a load-bearing decision require a reviewed plan and migration path.

## Context

MasterBall Store needs one Vietnamese storefront and one protected operations console. Inventory integrity, payment evidence, and a small operating team matter more than independent service scaling.

## Decisions

- Use a single Next.js App Router application with domain modules. PostgreSQL is the source of truth, and Drizzle owns reviewed migrations. See `src/db/`, `src/modules/`, and `drizzle/`.
- Support guest checkout with a signed opaque cart token. Customer accounts, loyalty, marketplace, auctions, POS, livebreak, and tournament registration are outside this release.
- Give guests two ways to read their own order: the permanent unguessable lookup link emailed with the confirmation, and a short-lived `/orders` session granted only when the order number matches the phone number used at checkout. Failed lookups return one generic message, the granted cookie is httpOnly, scoped to `/orders`, and expires after 30 minutes, and no lookup surface exposes payment or address data.
- Require the buyer to accept the published terms, return, and privacy policies before an order is created. Checkout links to those policies and the server rejects an unaccepted submission; enabling or enforcing consent is not delegated to the browser.
- Model sealed products, single cards, and accessories through products and variants rather than per-game tables. One logical warehouse and integer VND amounts are the initial operating boundary.
- Offer COD and one online provider, VNPAY 2.1.0. Only a verified IPN or a server-to-server QueryDr response with a valid HMAC-SHA512 checksum may change payment truth; a browser Return URL is display-only. QueryDr statuses other than confirmed success are evidence only and do not cancel an order early. See `src/modules/payments/`.
- Calculate shipping from server-owned regional rules. Courier API integration requires a separate failure and idempotency design.
- Publish tournament announcements on the website only. Registration, fees, pairings, and external Facebook/Zalo/email automation are not implied.
- Protect admin work with Better Auth database sessions and four roles: `OWNER`, `CATALOG_MANAGER`, `ORDER_STAFF`, and `EVENT_EDITOR`. Capabilities are enforced at server entry points in `src/modules/auth/`.
- Serve the storefront in Vietnamese and English from one URL space, choosing the language with the `masterball_locale` cookie rendered on the server. This costs static rendering for storefront routes (the layout reads a cookie) and database content stays in the language it was entered in; locale-in-URL was rejected because it would double every route before the shop has translated catalog data to justify it.
- Keep the address model as free-text ward, district, and province, but offer the current 34-province list (provinces.open-api.vn v2) as a select so the shipping region is never a spelling guess; the control degrades to a text input when the dataset is unreachable, and the pre-2025 `depth=3` dataset is not used.
- Run scheduled maintenance as three idempotent `POST` endpoints guarded by `CRON_SECRET` (`release-expired`, `publish-scheduled`, `process-email-outbox`). The scheduler lives outside the application; `/admin/jobs` lets an operator run the same service entry point by hand during an incident. See `docs/operations/scheduled-jobs.md`.
- Keep object storage and email behind adapters. Production media must have provenance and alt text.
- Use an original MasterBall Store visual language inspired by the supplied purple, magenta, black, white, silver, and cyan palette. Do not reproduce a Poké Ball/Master Ball, franchise logo, character, or unlicensed card artwork.

## Consequences

The modular monolith is easy to deploy and transact across, but shared database migrations are coordinated releases. A single warehouse and region-based shipping keep the first release operable but must be revisited before adding locations or courier allocation. Online payment cannot be enabled until merchant sandbox evidence exists.

## Alternatives considered

- Microservices were rejected because they add distributed consistency and operational cost before the store needs independent scaling.
- A marketplace/CMS/commerce SaaS composition was rejected because atomic inventory reservations and payment exception handling remain core application behavior.
- Client-side payment confirmation and manually setting an order to paid were rejected because neither provides trustworthy provider evidence.
- Automatic marketplace and social synchronization was deferred until the shop defines an authoritative source and conflict policy.
