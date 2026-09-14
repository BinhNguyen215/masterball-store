import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  games,
  inventories,
  products,
  productSets,
  productVariants,
} from "@/db/schema";

export type ProductExportRow = {
  title: string;
  slug: string;
  gameSlug: string;
  setCode: string | null;
  type: string;
  productStatus: string;
  description: string;
  sku: string;
  variantStatus: string;
  language: string;
  condition: string | null;
  edition: string | null;
  finish: string | null;
  priceVnd: number;
  weightGram: number;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
};

const PRODUCT_EXPORT_COLUMNS: ReadonlyArray<keyof ProductExportRow> = [
  "title",
  "slug",
  "gameSlug",
  "setCode",
  "type",
  "productStatus",
  "description",
  "sku",
  "variantStatus",
  "language",
  "condition",
  "edition",
  "finish",
  "priceVnd",
  "weightGram",
  "onHand",
  "reserved",
  "available",
  "reorderPoint",
];

function spreadsheetSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function encodeCsvCell(value: string | number | null): string {
  const normalized = spreadsheetSafe(value === null ? "" : String(value));
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function serializeProductExportRows(rows: ProductExportRow[]): string {
  const header = PRODUCT_EXPORT_COLUMNS.map(encodeCsvCell).join(",");
  const body = rows.map((row) =>
    PRODUCT_EXPORT_COLUMNS.map((column) => encodeCsvCell(row[column])).join(","),
  );

  return [header, ...body].join("\r\n") + "\r\n";
}

export async function exportProductsCsv(): Promise<string> {
  const rows = await getDb()
    .select({
      title: products.title,
      slug: products.slug,
      gameSlug: games.slug,
      setCode: productSets.code,
      type: products.type,
      productStatus: products.status,
      description: products.description,
      sku: productVariants.sku,
      variantStatus: productVariants.status,
      language: productVariants.language,
      condition: productVariants.condition,
      edition: productVariants.edition,
      finish: productVariants.finish,
      priceVnd: productVariants.priceVnd,
      weightGram: productVariants.weightGram,
      onHand: sql<number>`coalesce(${inventories.onHand}, 0)`,
      reserved: sql<number>`coalesce(${inventories.reserved}, 0)`,
      available: sql<number>`coalesce(${inventories.onHand} - ${inventories.reserved}, 0)`,
      reorderPoint: sql<number>`coalesce(${inventories.reorderPoint}, 0)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(games, eq(products.gameId, games.id))
    .leftJoin(productSets, eq(products.setId, productSets.id))
    .leftJoin(inventories, eq(productVariants.id, inventories.variantId))
    .orderBy(asc(products.slug), asc(productVariants.sku));

  return serializeProductExportRows(rows);
}
