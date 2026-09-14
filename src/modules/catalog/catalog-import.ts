import { parse } from "csv-parse/sync";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  games,
  inventories,
  productSets,
  productVariants,
  products,
} from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";
import { adjustInventoryInTransaction } from "@/modules/inventory";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);

const importRowSchema = z.object({
  gameSlug: z.string().trim().min(1),
  setCode: optionalText,
  productType: z.enum(["SEALED", "SINGLE", "ACCESSORY"]),
  productTitle: z.string().trim().min(1).max(250),
  productSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().default(""),
  sku: z.string().trim().min(1).max(120),
  language: z.string().trim().min(1).max(50),
  condition: optionalText,
  edition: optionalText,
  finish: optionalText,
  priceVnd: z.coerce.number().int().min(0).max(2_147_483_647),
  weightGram: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  onHand: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
});

type ImportRow = z.infer<typeof importRowSchema> & { rowNumber: number };
type ImportError = { rowNumber: number; field?: string; message: string };

export async function importProductsCsv(input: {
  csv: string;
  actorId: string;
  requestId?: string;
  dryRun?: boolean;
}) {
  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(input.csv, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    return {
      valid: false as const,
      errors: [{ rowNumber: 0, message: error instanceof Error ? error.message : "Invalid CSV" }],
      rows: [],
    };
  }
  if (rawRows.length > 1000) {
    return {
      valid: false as const,
      errors: [{ rowNumber: 0, message: "CSV import is limited to 1000 rows." }],
      rows: [],
    };
  }

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  rawRows.forEach((raw, index) => {
    const result = importRowSchema.safeParse(raw);
    if (result.success) rows.push({ ...result.data, rowNumber: index + 2 });
    else {
      for (const issue of result.error.issues) {
        errors.push({
          rowNumber: index + 2,
          field: issue.path.join("."),
          message: issue.message,
        });
      }
    }
  });

  const seenSlugs = new Map<string, ImportRow>();
  const seenSkus = new Set<string>();
  for (const row of rows) {
    const existingProduct = seenSlugs.get(row.productSlug);
    if (
      existingProduct &&
      (existingProduct.gameSlug !== row.gameSlug ||
        existingProduct.setCode !== row.setCode ||
        existingProduct.productType !== row.productType ||
        existingProduct.productTitle !== row.productTitle)
    ) {
      errors.push({ rowNumber: row.rowNumber, field: "productSlug", message: "Rows for one product slug disagree on product fields." });
    }
    seenSlugs.set(row.productSlug, existingProduct ?? row);
    if (seenSkus.has(row.sku)) {
      errors.push({ rowNumber: row.rowNumber, field: "sku", message: "SKU is duplicated in this CSV." });
    }
    seenSkus.add(row.sku);
  }

  if (!errors.length && rows.length) {
    const [knownGames, knownProducts, knownVariants] = await Promise.all([
      getDb().select().from(games).where(inArray(games.slug, [...new Set(rows.map((row) => row.gameSlug))])),
      getDb().select({ slug: products.slug }).from(products).where(inArray(products.slug, [...seenSlugs.keys()])),
      getDb().select({ sku: productVariants.sku }).from(productVariants).where(inArray(productVariants.sku, [...seenSkus])),
    ]);
    const gameSlugs = new Set(knownGames.map((game) => game.slug));
    const gameBySlug = new Map(knownGames.map((game) => [game.slug, game.id]));
    const productSlugs = new Set(knownProducts.map((product) => product.slug));
    const variantSkus = new Set(knownVariants.map((variant) => variant.sku));
    const requestedSetCodes = [...new Set(rows.flatMap((row) => row.setCode ? [row.setCode] : []))];
    const knownSets = requestedSetCodes.length && knownGames.length
      ? await getDb()
          .select({ gameId: productSets.gameId, code: productSets.code })
          .from(productSets)
          .where(
            and(
              inArray(productSets.gameId, knownGames.map((game) => game.id)),
              inArray(productSets.code, requestedSetCodes),
            ),
          )
      : [];
    const setKeys = new Set(knownSets.map((set) => `${set.gameId}:${set.code}`));
    for (const row of rows) {
      if (!gameSlugs.has(row.gameSlug)) errors.push({ rowNumber: row.rowNumber, field: "gameSlug", message: "Game does not exist." });
      const gameId = gameBySlug.get(row.gameSlug);
      if (row.setCode && gameId && !setKeys.has(`${gameId}:${row.setCode}`)) {
        errors.push({ rowNumber: row.rowNumber, field: "setCode", message: "Set does not exist for this game." });
      }
      if (productSlugs.has(row.productSlug)) errors.push({ rowNumber: row.rowNumber, field: "productSlug", message: "Product slug already exists." });
      if (variantSkus.has(row.sku)) errors.push({ rowNumber: row.rowNumber, field: "sku", message: "SKU already exists." });
    }
  }

  if (errors.length || input.dryRun !== false) {
    return { valid: errors.length === 0, errors, rows };
  }

  const inserted = await getDb().transaction(async (tx) => {
    const gameRows = await tx
      .select()
      .from(games)
      .where(inArray(games.slug, [...new Set(rows.map((row) => row.gameSlug))]));
    const gameBySlug = new Map(gameRows.map((game) => [game.slug, game]));
    const productBySlug = new Map<string, string>();
    const createdProductIds: string[] = [];
    const createdVariantIds: string[] = [];

    for (const row of rows) {
      const game = gameBySlug.get(row.gameSlug)!;
      let productId = productBySlug.get(row.productSlug);
      if (!productId) {
        let setId: string | null = null;
        if (row.setCode) {
          const [set] = await tx
            .select({ id: productSets.id })
            .from(productSets)
            .where(and(eq(productSets.gameId, game.id), eq(productSets.code, row.setCode)))
            .limit(1);
          if (!set) throw new Error(`Set ${row.setCode} does not exist for game ${row.gameSlug}.`);
          setId = set.id;
        }
        const [product] = await tx
          .insert(products)
          .values({
            gameId: game.id,
            setId,
            type: row.productType,
            title: row.productTitle,
            slug: row.productSlug,
            description: row.description,
            status: row.status,
            publishedAt: row.status === "ACTIVE" ? new Date() : null,
          })
          .returning({ id: products.id });
        productId = product.id;
        productBySlug.set(row.productSlug, productId);
        createdProductIds.push(productId);
      }
      const [variant] = await tx
        .insert(productVariants)
        .values({
          productId,
          sku: row.sku,
          status: row.status,
          language: row.language,
          condition: row.condition,
          edition: row.edition,
          finish: row.finish,
          priceVnd: row.priceVnd,
          weightGram: row.weightGram,
        })
        .returning({ id: productVariants.id });
      createdVariantIds.push(variant.id);
      await tx.insert(inventories).values({ variantId: variant.id });
      if (row.onHand > 0) {
        await adjustInventoryInTransaction(tx, {
          variantId: variant.id,
          onHandDelta: row.onHand,
          referenceType: "CSV_IMPORT",
          referenceId: input.requestId ?? `import:${row.rowNumber}`,
          actorId: input.actorId,
        });
      }
    }
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.products.import",
      subjectType: "catalog-import",
      subjectId: input.requestId ?? `import-${Date.now()}`,
      after: { productIds: createdProductIds, variantIds: createdVariantIds },
      requestId: input.requestId,
    });
    return { productIds: createdProductIds, variantIds: createdVariantIds };
  });
  return { valid: true as const, errors: [], rows, inserted };
}
