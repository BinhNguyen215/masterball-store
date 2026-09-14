import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/0000_commerce-foundation.sql"),
  "utf8",
);

describe("commerce foundation migration", () => {
  it("enforces stock, VND totals, idempotency, and snapshot relations", () => {
    expect(migration).toContain('CONSTRAINT "inventories_available_check"');
    expect(migration).toContain('"on_hand" - "inventories"."reserved" >= 0');
    expect(migration).toContain('CONSTRAINT "orders_checkout_idempotency_key_unique"');
    expect(migration).toContain('CONSTRAINT "orders_total_check"');
    expect(migration).toContain('CONSTRAINT "order_items_total_check"');
    expect(migration).toContain('CONSTRAINT "payment_events_provider_event_unique"');
  });

  it("uses UTC-capable timestamps and real auth-compatible actor foreign keys", () => {
    expect(migration).toContain("timestamp with time zone");
    expect(migration).toContain('CREATE TABLE "user"');
    expect(migration).toContain('FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null');
    expect(migration).toContain("'OWNER', 'CATALOG_MANAGER', 'ORDER_STAFF', 'EVENT_EDITOR'");
    expect(migration).toContain('CREATE TABLE "rateLimit"');
  });

  it("contains the late-payment manual-review state and tournament time checks", () => {
    expect(migration).toContain("'MANUAL_REVIEW'");
    expect(migration).toContain('CONSTRAINT "tournaments_time_check"');
    expect(migration).toContain('CONSTRAINT "tournaments_deadline_check"');
  });
});
