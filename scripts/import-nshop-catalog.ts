import { readFile, stat, unlink, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import sharp from "sharp";

import { closeDb, getDb } from "../src/db/index";
import { games, inventories, productVariants, products } from "../src/db/schema";
import { appendAuditLog } from "../src/modules/audit";


const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;
const IMAGE_ROOT = resolve(process.cwd(), "public/images/nshop");

const imageSchema = z.object({ url: z.string().url(), alt: z.string().trim().min(1).max(500) });
const variantSchema = z.object({
  sourceId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,200}$/),
  sourceSku: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(250),
  priceVnd: z.number().int().min(0).max(2_147_483_647),
  available: z.boolean(),
});
const productSchema = z.object({
  sourceId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,200}$/),
  sourceUrl: z.string().url(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(250),
  description: z.string().max(20_000),
  productType: z.enum(["SEALED", "SINGLE", "ACCESSORY"]),
  language: z.string().trim().min(1).max(50),
  images: z.array(imageSchema).max(50),
  variants: z.array(variantSchema).min(1).max(100),
});
const snapshotSchema = z.object({
  sourceUrl: z.string().url(),
  fetchedAt: z.string().datetime(),
  gameSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("pokemon"),
  gameName: z.string().trim().min(1).max(100).default("Pokémon TCG"),
  sourcePrefix: z.string().trim().regex(/^[A-Z0-9_-]{2,20}$/).default("NSHOP"),
  products: z.array(productSchema).max(10_000),
});
type Snapshot = z.infer<typeof snapshotSchema>;
type Product = Snapshot["products"][number];
type DownloadedImage = { sourceId: string; path: string; created: boolean };

type Arguments = { commit: boolean; file: string; repairDescriptions: boolean; stock: number };

function usage(): never {
  throw new Error("Usage: pnpm import:nshop -- [--file data/nshop-pokemon.json] [--commit] [--stock=<n>] [--repair-descriptions]");
}

function parseArguments(values: string[]): Arguments {
  let commit = false;
  let file = "data/nshop-pokemon.json";
  let repairDescriptions = false;
  let stock = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    // pnpm forwards the "--" separator as an argument value.
    if (value === "--") continue;
    if (value === "--commit") commit = true;
    else if (value === "--repair-descriptions") repairDescriptions = true;
    else if (value === "--file") { file = values[index + 1] ?? usage(); index += 1; }
    else if (value.startsWith("--stock=")) {
      stock = Number(value.slice("--stock=".length));
      if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) usage();
    }
    else usage();
  }
  return { commit, file, repairDescriptions, stock };
}

function loadEnvironment() {
  const loader = (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (!loader) return;
  try { loader(resolve(process.cwd(), ".env.local")); } catch { /* absent file */ }
  try { loader(resolve(process.cwd(), ".env")); } catch { /* absent file */ }
}

function verifyCommitGate(commit: boolean) {
  if (!commit || process.env.NODE_ENV !== "production") return;
  if (!process.env.MIGRATION_BACKUP_REFERENCE?.trim()) {
    throw new Error("Production import blocked: create and verify a backup, then set MIGRATION_BACKUP_REFERENCE.");
  }
}

function plainText(value: string): string {
  return value
    // Older snapshots prefixed the scraped description with a provenance line;
    // it stays in the variant attributes, never in customer-facing copy.
    .replace(/^\s*Source:\s*https?:\/\/\S+\s*/i, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function imageUrlAllowed(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "hstatic.net" || url.hostname.endsWith(".hstatic.net"));
  } catch { return false; }
}

async function downloadPrimaryImage(product: Product): Promise<DownloadedImage | null> {
  const primary = product.images[0];
  if (!primary || !imageUrlAllowed(primary.url)) return null;
  const output = resolve(IMAGE_ROOT, `${product.sourceId}.webp`);
  try {
    const existing = await stat(output);
    if (existing.isFile() && existing.size > 0) return { sourceId: product.sourceId, path: `/images/nshop/${product.sourceId}.webp`, created: false };
  } catch { /* not present */ }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(primary.url, { signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error(`image request returned ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_IMAGE_BYTES) throw new Error("image exceeds 10 MiB limit");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image exceeds 10 MiB limit");
    const converted = await sharp(bytes, { failOn: "error" }).webp({ quality: 85 }).toBuffer();
    if (converted.byteLength > MAX_IMAGE_BYTES) throw new Error("converted image exceeds 10 MiB limit");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, converted, { flag: "wx" }).catch(async (error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
    return { sourceId: product.sourceId, path: `/images/nshop/${product.sourceId}.webp`, created: true };
  } finally { clearTimeout(timeout); }
}

async function readSnapshot(file: string): Promise<Snapshot> {
  const raw = await readFile(resolve(file), "utf8");
  if (Buffer.byteLength(raw, "utf8") > MAX_SNAPSHOT_BYTES) throw new Error("nShop snapshot exceeds the 20 MiB limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("nShop snapshot is not valid JSON."); }
  const result = snapshotSchema.safeParse(parsed);
  if (!result.success) throw new Error(`Invalid nShop snapshot: ${result.error.message}`);
  const seenSlugs = new Set<string>();
  const seenSkus = new Set<string>();
  const seenSourceIds = new Set<string>();
  for (const product of result.data.products) {
    if (seenSlugs.has(product.slug)) throw new Error(`Duplicate product slug: ${product.slug}`);
    if (seenSourceIds.has(product.sourceId)) throw new Error(`Duplicate product sourceId: ${product.sourceId}`);
    seenSlugs.add(product.slug); seenSourceIds.add(product.sourceId);
    for (const variant of product.variants) {
      const sku = `NSHOP-${variant.sourceId}`;
      if (seenSkus.has(sku)) throw new Error(`Duplicate variant sourceId: ${variant.sourceId}`);
      seenSkus.add(sku);
    }
  }
  return result.data;
}

const descriptionSourcePattern = /^\s*Source:\s*https?:\/\/\S+\s*/i;

function stripDescriptionSource(value: string): string {
  return value.replace(descriptionSourcePattern, "").trim();
}

/**
 * Removes the provenance line that older snapshots embedded at the start of
 * every imported product description. Dry-run unless `--commit` is passed.
 */
async function repairDescriptions(commit: boolean) {
  const rows = await getDb()
    .select({ id: products.id, description: products.description, title: products.title })
    .from(products);
  const targets = rows.filter(
    (row) => typeof row.description === "string" && descriptionSourcePattern.test(row.description),
  );

  if (!commit) {
    console.log(
      JSON.stringify(
        {
          mode: "repair-dry-run",
          repairableProducts: targets.length,
          scannedProducts: rows.length,
          sample: targets.slice(0, 3).map((row) => row.title),
        },
        null,
        2,
      ),
    );
    return;
  }

  await getDb().transaction(async (tx) => {
    for (const row of targets) {
      const description = stripDescriptionSource(row.description ?? "");
      await tx
        .update(products)
        .set({
          description,
          version: sql`${products.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, row.id));
      await appendAuditLog(tx, {
        action: "catalog.description.repair",
        subjectType: "product",
        subjectId: row.id,
        before: { description: row.description },
        after: { description },
        requestId: `nshop-repair-${Date.now()}`,
      });
    }
  });
  console.log(JSON.stringify({ mode: "repair-commit", repairedProducts: targets.length }, null, 2));
}

async function main() {
  await loadEnvironment();
  const args = parseArguments(process.argv.slice(2));
  verifyCommitGate(args.commit);
  if (args.repairDescriptions) {
    await repairDescriptions(args.commit);
    return;
  }
  const snapshot = await readSnapshot(args.file);
  if (!args.commit) {
    console.log(JSON.stringify({ mode: "dry-run", valid: true, stockPerVariant: args.stock, products: snapshot.products.length, variants: snapshot.products.reduce((sum, product) => sum + product.variants.length, 0), imagesDownloaded: 0 }, null, 2));
    return;
  }

  const images: DownloadedImage[] = [];
  try {
    for (const product of snapshot.products) {
      const image = await downloadPrimaryImage(product);
      if (image) images.push(image);
    }
    const result = await getDb().transaction(async (tx) => {
      const [game] = await tx.select().from(games).where(eq(games.slug, snapshot.gameSlug)).limit(1);
      const targetGame = game ?? (await tx.insert(games).values({ name: snapshot.gameName, slug: snapshot.gameSlug, status: "ACTIVE" }).returning())[0];
      const insertedProductIds: string[] = [];
      const insertedVariantIds: string[] = [];
      const skippedProductIds: string[] = [];
      const skippedVariantCount = { value: 0 };
      const existingProducts = snapshot.products.length
        ? await tx.select().from(products).where(inArray(products.slug, snapshot.products.map((product) => product.slug)))
        : [];
      const existingBySlug = new Map(existingProducts.map((product) => [product.slug, product]));
      const sourceSkusInSnapshot = snapshot.products.flatMap((product) => product.variants.map((variant) => `${snapshot.sourcePrefix}-${variant.sourceId}`));
      const existingVariants = sourceSkusInSnapshot.length
        ? await tx.select().from(productVariants).where(inArray(productVariants.sku, sourceSkusInSnapshot))
        : [];
      const existingBySku = new Map(existingVariants.map((variant) => [variant.sku, variant]));
      let productIndex = 0;
      for (const product of snapshot.products) {
        const existing = existingBySlug.get(product.slug);
        const sourceSkus = product.variants.map((variant) => `${snapshot.sourcePrefix}-${variant.sourceId}`);
        if (existing) {
          const variants = await tx.select().from(productVariants).where(eq(productVariants.productId, existing.id));
          const owned = variants.filter((variant) => typeof variant.attributes?.sourceId === "string");
          const complete = owned.length === sourceSkus.length && sourceSkus.every((sku) => variants.some((variant) => variant.sku === sku && variant.attributes?.sourceId === sku.slice(snapshot.sourcePrefix.length + 1)));
          if (!complete) throw new Error(`Product slug conflict or incomplete source import: ${product.slug}`);
          skippedProductIds.push(existing.id);
          skippedVariantCount.value += sourceSkus.length;
          productIndex += 1;
          continue;
        }
        for (const sku of sourceSkus) if (existingBySku.has(sku)) throw new Error(`Variant SKU conflict: ${sku}`);
        const description = plainText(product.description);
        const inserted = (await tx.insert(products).values({ gameId: targetGame.id, type: product.productType, title: product.title, slug: product.slug, description, status: "ACTIVE", featured: productIndex < 3, publishedAt: new Date() }).returning())[0];
        insertedProductIds.push(inserted.id);
        for (const variant of product.variants) {
          const localImage = images.find((image) => image.sourceId === product.sourceId)?.path;
          const attributes = { sourceUrl: product.sourceUrl, sourceId: variant.sourceId, sourceSku: variant.sourceSku, sourceAvailable: variant.available, sourceFetchedAt: snapshot.fetchedAt, ...(localImage ? { localImage } : {}) };
          const createdVariant = (await tx.insert(productVariants).values({ productId: inserted.id, sku: `${snapshot.sourcePrefix}-${variant.sourceId}`, status: "ACTIVE", language: product.language, attributes, priceVnd: variant.priceVnd }).returning())[0];
          insertedVariantIds.push(createdVariant.id);
          await tx.insert(inventories).values({ variantId: createdVariant.id, onHand: args.stock });
        }
        productIndex += 1;
      }
      await appendAuditLog(tx, { action: `catalog.${snapshot.sourcePrefix.toLowerCase()}.import`, subjectType: `${snapshot.gameSlug}-catalog`, subjectId: snapshot.fetchedAt, after: { insertedProductIds, insertedVariantIds, skippedProductIds }, requestId: `${snapshot.sourcePrefix.toLowerCase()}-import-${Date.now()}` });
      return { insertedProducts: insertedProductIds.length, insertedVariants: insertedVariantIds.length, skippedProducts: skippedProductIds.length, skippedVariants: skippedVariantCount.value };
    });
    console.log(JSON.stringify({ mode: "commit", ...result, stockPerVariant: args.stock, imagesDownloaded: images.filter((image) => image.created).length }, null, 2));
    if (args.stock === 0 && result.insertedVariants > 0) {
      console.warn("Warning: imported variants start with 0 stock and cannot be sold. Re-run with --stock=<n> or set stock from the inventory console.");
    }
  } catch (error) {
    for (const image of images.filter((item) => item.created)) await unlink(resolve(process.cwd(), `public${image.path}`)).catch(() => undefined);
    throw error;
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? `${error.message}\n${error.cause instanceof Error ? error.cause.message : ""}` : "nShop import failed."); process.exitCode = 1; }).finally(closeDb);
