# Architecture decisions

## Status

Accepted for the first production-capable release. Changes to a load-bearing decision require a reviewed plan and migration path.

## Context

MasterBall Store needs one Vietnamese storefront and one protected operations console. Inventory integrity, payment evidence, and a small operating team matter more than independent service scaling.

## Decisions

- Use a single Next.js App Router application with domain modules. PostgreSQL is the source of truth, and Drizzle owns reviewed migrations. See `src/db/`, `src/modules/`, and `drizzle/`.
- Support guest checkout with a signed opaque cart token. Customer accounts, loyalty, marketplace, auctions, POS, livebreak, and tournament registration are outside this release.
- Model sealed products, single cards, and accessories through products and variants rather than per-game tables. One logical warehouse and integer VND amounts are the initial operating boundary.
- Offer COD and one online provider, VNPAY 2.1.0. Only a verified IPN or a server-to-server QueryDr response with a valid HMAC-SHA512 checksum may change payment truth; a browser Return URL is display-only. QueryDr statuses other than confirmed success are evidence only and do not cancel an order early. See `src/modules/payments/`.
- Calculate shipping from server-owned regional rules. Courier API integration requires a separate failure and idempotency design.
- Publish tournament announcements on the website only. Registration, fees, pairings, and external Facebook/Zalo/email automation are not implied.
- Protect admin work with Better Auth database sessions and four roles: `OWNER`, `CATALOG_MANAGER`, `ORDER_STAFF`, and `EVENT_EDITOR`. Capabilities are enforced at server entry points in `src/modules/auth/`.
- Keep object storage and email behind adapters. Production media must have provenance and alt text.
- Use an original MasterBall Store visual language inspired by the supplied purple, magenta, black, white, silver, and cyan palette. Do not reproduce a Poké Ball/Master Ball, franchise logo, character, or unlicensed card artwork.

## Consequences

The modular monolith is easy to deploy and transact across, but shared database migrations are coordinated releases. A single warehouse and region-based shipping keep the first release operable but must be revisited before adding locations or courier allocation. Online payment cannot be enabled until merchant sandbox evidence exists.

## Alternatives considered

- Microservices were rejected because they add distributed consistency and operational cost before the store needs independent scaling.
- A marketplace/CMS/commerce SaaS composition was rejected because atomic inventory reservations and payment exception handling remain core application behavior.
- Client-side payment confirmation and manually setting an order to paid were rejected because neither provides trustworthy provider evidence.
- Automatic marketplace and social synchronization was deferred until the shop defines an authoritative source and conflict policy.
