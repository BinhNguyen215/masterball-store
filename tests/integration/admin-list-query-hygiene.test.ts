import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listAuditLogs } from "@/modules/audit";
import { listAdminInventory } from "@/modules/inventory";
import { listProductMedia } from "@/modules/media";
import type { MediaStorage } from "@/modules/media/s3-media-storage";
import {
  listAdminTournaments,
  listPublishedTournamentSitemapEntries,
} from "@/modules/tournaments";

/**
 * These guard the SQL the admin lists hand to PostgreSQL. The audit findings
 * were about *emitted* queries — an unbounded `count(*)`, a `::text` cast that
 * defeats an enum index, and lists without a `LIMIT` — so the transport is
 * stubbed and the statements themselves are asserted. Rows come back empty
 * except where a caller needs a lookup hit.
 */

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const COUNT_ROWS = 7;

type CapturedQuery = { sql: string; params: unknown[] };

const captured: CapturedQuery[] = [];
const originalQuery = Pool.prototype.query;
const originalDatabaseUrl = process.env.DATABASE_URL;

function fakeRows(sql: string): unknown[][] {
  if (/select count\(\*\)/i.test(sql)) return [[COUNT_ROWS]];
  if (sql.includes('from "products"')) return [[PRODUCT_ID]];
  return [];
}

const storage: MediaStorage = {
  putObject: async () => {},
  deleteObject: async () => {},
  publicUrl: (objectKey) => `https://cdn.example.test/${objectKey}`,
};

function itemsQuery(): CapturedQuery {
  const query = captured.find((entry) => !/select count\(\*\)/i.test(entry.sql));
  if (!query) throw new Error("No row query was issued.");
  return query;
}

function countQuery(): CapturedQuery {
  const query = captured.find((entry) => /select count\(\*\)/i.test(entry.sql));
  if (!query) throw new Error("No count query was issued.");
  return query;
}

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://query-hygiene:query-hygiene@127.0.0.1:5432/query-hygiene";
  Pool.prototype.query = (async function (
    this: unknown,
    config: { text: string } | string,
    params?: unknown[],
  ) {
    const sql = typeof config === "string" ? config : config.text;
    captured.push({ sql, params: (params ?? []) as unknown[] });
    return { rows: fakeRows(sql), fields: [], command: "SELECT", rowCount: 0, oid: 0 };
  }) as unknown as typeof Pool.prototype.query;
});

beforeEach(() => {
  captured.length = 0;
});

afterAll(() => {
  Pool.prototype.query = originalQuery;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("admin list query hygiene", () => {
  it("caps the inventory count one row past the requested page", async () => {
    const result = await listAdminInventory({ limit: 50, offset: 0 });

    expect(Object.keys(result).sort()).toEqual(["items", "total"]);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(COUNT_ROWS);

    const count = countQuery();
    expect(count.sql).toMatch(/^select count\(\*\) from \(select .+ limit \$\d+\)/i);
    expect(count.params).toEqual([51]);
    expect(count.sql).not.toContain("::text");
    expect(itemsQuery().params).toEqual([50]);
  });

  it("caps counts relative to the page being read, not a fixed constant", async () => {
    await listAdminInventory({ limit: 20, offset: 100 });
    expect(countQuery().params).toEqual([121]);
    expect(itemsQuery().params).toEqual([20, 100]);
  });

  it("filters admin tournaments on the enum column instead of a text cast", async () => {
    await listAdminTournaments({ status: "PUBLISHED", limit: 20, offset: 40 });

    const items = itemsQuery();
    expect(items.sql).toContain('"tournaments"."publication_status" = $1');
    expect(items.sql).not.toContain("::text");
    expect(countQuery().sql).not.toContain("::text");
    expect(countQuery().params).toEqual(["PUBLISHED", 61]);
  });

  it("keeps unknown tournament filters matching nothing without failing the enum comparison", async () => {
    await listAdminTournaments({ status: "NOT_A_STATUS" });

    const items = itemsQuery();
    expect(items.sql).not.toContain("::text");
    expect(items.sql).toContain("false");
    expect(items.params).toEqual([50]);
  });

  it("still filters cancelled tournaments through the cancellation flag", async () => {
    await listAdminTournaments({ status: "CANCELLED" });

    const items = itemsQuery();
    expect(items.sql).toContain('"tournaments"."cancelled" = $1');
    expect(items.params).toEqual([true, 50]);
  });

  it("caps the audit log count and keeps the returned total numeric", async () => {
    const result = await listAuditLogs({ limit: 10, offset: 20 });

    expect(result.total).toBe(COUNT_ROWS);
    expect(countQuery().params).toEqual([31]);
  });

  it("bounds the tournament sitemap entries", async () => {
    await listPublishedTournamentSitemapEntries();

    const query = itemsQuery();
    expect(query.sql).toMatch(/limit \$\d+$/);
    expect(query.params).toEqual(["PUBLISHED", 5_000]);
  });

  it("bounds a product gallery read", async () => {
    const items = await listProductMedia(PRODUCT_ID, storage);

    expect(items).toEqual([]);
    const gallery = captured.at(-1)!;
    expect(gallery.sql).toContain('from "media_assets"');
    expect(gallery.params).toEqual([PRODUCT_ID, 200]);
  });
});
