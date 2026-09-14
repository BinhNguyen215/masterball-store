import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  games,
  inventories,
  productTags,
  productSets,
  productVariants,
  products,
  tags,
} from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const status = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
const productType = z.enum(["SEALED", "SINGLE", "ACCESSORY"]);
const actorContext = z.object({
  actorId: z.string().min(1),
  requestId: z.string().min(1).optional(),
});

export class CatalogError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "VERSION_CONFLICT" | "INVALID_STATE") {
    super(message);
    this.name = "CatalogError";
  }
}

export async function createGame(raw: unknown) {
  const input = actorContext.extend({
    name: z.string().trim().min(1).max(120),
    slug,
    status: status.default("DRAFT"),
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(games)
      .values({ name: input.name, slug: input.slug, status: input.status })
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.game.create",
      subjectType: "game",
      subjectId: created.id,
      after: created,
      requestId: input.requestId,
    });
    return created;
  });
}

export async function setGameStatus(raw: unknown) {
  const input = actorContext.extend({
    id: z.string().uuid(),
    status,
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(games)
      .where(eq(games.id, input.id))
      .limit(1)
      .for("update");
    if (!before) throw new CatalogError("Game was not found.", "NOT_FOUND");
    if (before.status === "ARCHIVED" && input.status !== "ARCHIVED") {
      throw new CatalogError("Archived games cannot be reactivated.", "INVALID_STATE");
    }
    const [updated] = await tx
      .update(games)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(games.id, input.id))
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.game.status",
      subjectType: "game",
      subjectId: before.id,
      before,
      after: updated,
      requestId: input.requestId,
    });
    return updated;
  });
}

export async function createProductSet(raw: unknown) {
  const input = actorContext.extend({
    gameId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    code: z.string().trim().min(1).max(80),
    releaseDate: z.string().date().optional(),
    status: status.default("DRAFT"),
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(productSets)
      .values({
        gameId: input.gameId,
        name: input.name,
        code: input.code,
        releaseDate: input.releaseDate,
        status: input.status,
      })
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.set.create",
      subjectType: "product-set",
      subjectId: created.id,
      after: created,
      requestId: input.requestId,
    });
    return created;
  });
}

export async function setProductSetStatus(raw: unknown) {
  const input = actorContext.extend({
    id: z.string().uuid(),
    status,
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(productSets)
      .where(eq(productSets.id, input.id))
      .limit(1)
      .for("update");
    if (!before) throw new CatalogError("Product set was not found.", "NOT_FOUND");
    if (before.status === "ARCHIVED" && input.status !== "ARCHIVED") {
      throw new CatalogError("Archived product sets cannot be reactivated.", "INVALID_STATE");
    }
    const [updated] = await tx
      .update(productSets)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(productSets.id, input.id))
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.set.status",
      subjectType: "product-set",
      subjectId: before.id,
      before,
      after: updated,
      requestId: input.requestId,
    });
    return updated;
  });
}

export async function createTag(raw: unknown) {
  const input = actorContext.extend({
    name: z.string().trim().min(1).max(120),
    slug,
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(tags)
      .values({ name: input.name, slug: input.slug })
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.tag.create",
      subjectType: "tag",
      subjectId: created.id,
      after: created,
      requestId: input.requestId,
    });
    return created;
  });
}

export async function replaceProductTags(raw: unknown) {
  const input = actorContext.extend({
    productId: z.string().uuid(),
    tagIds: z.array(z.string().uuid()).max(50),
  }).parse(raw);
  const uniqueTagIds = [...new Set(input.tagIds)];

  return getDb().transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1)
      .for("update");
    if (!product) throw new CatalogError("Product was not found.", "NOT_FOUND");

    const before = await tx
      .select({ tagId: productTags.tagId })
      .from(productTags)
      .where(eq(productTags.productId, product.id));
    if (uniqueTagIds.length) {
      const known = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, uniqueTagIds));
      if (known.length !== uniqueTagIds.length) {
        throw new CatalogError("One or more tags were not found.", "NOT_FOUND");
      }
    }

    await tx.delete(productTags).where(eq(productTags.productId, product.id));
    if (uniqueTagIds.length) {
      await tx.insert(productTags).values(
        uniqueTagIds.map((tagId) => ({ productId: product.id, tagId })),
      );
    }
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.product.tags.replace",
      subjectType: "product",
      subjectId: product.id,
      before: { tagIds: before.map((item) => item.tagId) },
      after: { tagIds: uniqueTagIds },
      requestId: input.requestId,
    });
    return uniqueTagIds;
  });
}

const productFields = {
  gameId: z.string().uuid(),
  setId: z.string().uuid().nullable().optional(),
  type: productType,
  title: z.string().trim().min(1).max(250),
  slug,
  description: z.string().max(50_000).default(""),
  featured: z.boolean().default(false),
  seoTitle: z.string().trim().max(250).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
};

export async function createProduct(raw: unknown) {
  const input = actorContext.extend({
    ...productFields,
    status: status.default("DRAFT"),
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        gameId: input.gameId,
        setId: input.setId ?? null,
        type: input.type,
        title: input.title,
        slug: input.slug,
        description: input.description,
        featured: input.featured,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        status: input.status,
        publishedAt: input.status === "ACTIVE" ? new Date() : null,
      })
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.product.create",
      subjectType: "product",
      subjectId: created.id,
      after: created,
      requestId: input.requestId,
    });
    return created;
  });
}

export async function updateProduct(raw: unknown) {
  const input = actorContext.extend({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    changes: z.object(productFields).partial().refine((value) => Object.keys(value).length > 0),
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1)
      .for("update");
    if (!before) throw new CatalogError("Product was not found.", "NOT_FOUND");
    if (before.version !== input.expectedVersion) {
      throw new CatalogError("Product was changed by another request.", "VERSION_CONFLICT");
    }
    const [updated] = await tx
      .update(products)
      .set({
        ...input.changes,
        version: sql`${products.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, input.id), eq(products.version, input.expectedVersion)))
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.product.update",
      subjectType: "product",
      subjectId: before.id,
      before,
      after: updated,
      requestId: input.requestId,
    });
    return updated;
  });
}

export async function setProductStatus(raw: unknown) {
  const input = actorContext.extend({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    status,
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1)
      .for("update");
    if (!before) throw new CatalogError("Product was not found.", "NOT_FOUND");
    if (before.version !== input.expectedVersion) {
      throw new CatalogError("Product was changed by another request.", "VERSION_CONFLICT");
    }
    if (before.status === "ARCHIVED" && input.status !== "ARCHIVED") {
      throw new CatalogError("Archived products cannot be reactivated.", "INVALID_STATE");
    }
    const [updated] = await tx
      .update(products)
      .set({
        status: input.status,
        publishedAt:
          input.status === "ACTIVE" ? (before.publishedAt ?? new Date()) : before.publishedAt,
        version: sql`${products.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, before.id))
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.product.status",
      subjectType: "product",
      subjectId: before.id,
      before,
      after: updated,
      requestId: input.requestId,
    });
    return updated;
  });
}

const variantFields = {
  sku: z.string().trim().min(1).max(120),
  status: status.default("DRAFT"),
  language: z.string().trim().min(1).max(50),
  condition: z.string().trim().max(80).nullable().optional(),
  edition: z.string().trim().max(80).nullable().optional(),
  finish: z.string().trim().max(80).nullable().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  priceVnd: z.number().int().min(0).max(2_147_483_647),
  weightGram: z.number().int().min(0).max(2_147_483_647).default(0),
};

export async function createProductVariant(raw: unknown) {
  const input = actorContext.extend({
    productId: z.string().uuid(),
    ...variantFields,
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(productVariants)
      .values({
        productId: input.productId,
        sku: input.sku,
        status: input.status,
        language: input.language,
        condition: input.condition ?? null,
        edition: input.edition ?? null,
        finish: input.finish ?? null,
        attributes: input.attributes,
        priceVnd: input.priceVnd,
        weightGram: input.weightGram,
      })
      .returning();
    await tx.insert(inventories).values({ variantId: created.id });
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.variant.create",
      subjectType: "product-variant",
      subjectId: created.id,
      after: created,
      requestId: input.requestId,
    });
    return created;
  });
}

export async function updateProductVariant(raw: unknown) {
  const input = actorContext.extend({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    changes: z.object(variantFields).partial().refine((value) => Object.keys(value).length > 0),
  }).parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, input.id))
      .limit(1)
      .for("update");
    if (!before) throw new CatalogError("Variant was not found.", "NOT_FOUND");
    if (before.version !== input.expectedVersion) {
      throw new CatalogError("Variant was changed by another request.", "VERSION_CONFLICT");
    }
    const [updated] = await tx
      .update(productVariants)
      .set({
        ...input.changes,
        version: sql`${productVariants.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productVariants.id, before.id),
          eq(productVariants.version, input.expectedVersion),
        ),
      )
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.variant.update",
      subjectType: "product-variant",
      subjectId: before.id,
      before,
      after: updated,
      requestId: input.requestId,
    });
    return updated;
  });
}
