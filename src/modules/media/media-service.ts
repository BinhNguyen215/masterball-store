import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { mediaAssets, products, productVariants } from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

import {
  getDefaultMediaStorage,
  type MediaStorage,
} from "./s3-media-storage";
import { validateProductMedia } from "./media-validation";

const uuid = z.string().uuid();
const altText = z.string().trim().min(1).max(500);

export class MediaManagementError extends Error {
  constructor(
    message: string,
    readonly code:
      | "PRODUCT_NOT_FOUND"
      | "VARIANT_NOT_FOUND"
      | "MEDIA_NOT_FOUND"
      | "ARCHIVED_PRODUCT"
      | "OBJECT_COMPENSATION_FAILED"
      | "OBJECT_CLEANUP_FAILED",
    options?: ErrorOptions & { objectKey?: string; databaseDeleted?: boolean },
  ) {
    super(message, options);
    this.name = "MediaManagementError";
    this.objectKey = options?.objectKey;
    this.databaseDeleted = options?.databaseDeleted ?? false;
  }

  readonly objectKey?: string;
  readonly databaseDeleted: boolean;
}

export async function runWithObjectCompensation<T>(
  storage: MediaStorage,
  objectKey: string,
  persist: () => Promise<T>,
): Promise<T> {
  try {
    return await persist();
  } catch (persistenceError) {
    try {
      await storage.deleteObject(objectKey);
    } catch (cleanupError) {
      throw new MediaManagementError(
        `Media persistence failed and object compensation also failed for ${objectKey}.`,
        "OBJECT_COMPENSATION_FAILED",
        {
          cause: new AggregateError([persistenceError, cleanupError]),
          objectKey,
        },
      );
    }
    throw persistenceError;
  }
}

export function moveMediaToSortOrder<T extends { id: string }>(
  rows: T[],
  mediaId: string,
  requestedSortOrder: number,
): T[] {
  const currentIndex = rows.findIndex((row) => row.id === mediaId);
  if (currentIndex < 0) return rows;
  const next = [...rows];
  const [target] = next.splice(currentIndex, 1);
  const targetIndex = Math.max(0, Math.min(requestedSortOrder, next.length));
  next.splice(targetIndex, 0, target);
  return next;
}

async function assertUploadRelation(productId: string, variantId: string | null) {
  const [product] = await getDb()
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new MediaManagementError("Product was not found.", "PRODUCT_NOT_FOUND");
  }
  if (product.status === "ARCHIVED") {
    throw new MediaManagementError(
      "Archived products cannot receive new media.",
      "ARCHIVED_PRODUCT",
    );
  }
  if (variantId) {
    const [variant] = await getDb()
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId),
        ),
      )
      .limit(1);
    if (!variant) {
      throw new MediaManagementError(
        "Variant does not belong to the selected product.",
        "VARIANT_NOT_FOUND",
      );
    }
  }
}

export async function uploadProductMedia(
  rawInput: {
    productId: string;
    variantId?: string | null;
    altText: string;
    bytes: Buffer;
    actorId: string;
  },
  storage?: MediaStorage,
) {
  const input = z
    .object({
      productId: uuid,
      variantId: uuid.nullable().optional(),
      altText,
      bytes: z.instanceof(Buffer),
      actorId: z.string().min(1),
    })
    .parse(rawInput);
  const variantId = input.variantId ?? null;
  const prepared = await validateProductMedia({
    bytes: input.bytes,
    altText: input.altText,
    maxBytes: 10 * 1024 * 1024,
  });
  await assertUploadRelation(input.productId, variantId);
  const objectStorage = storage ?? (await getDefaultMediaStorage());
  await objectStorage.putObject({
    objectKey: prepared.objectKey,
    bytes: input.bytes,
    mimeType: prepared.mimeType,
  });

  const asset = await runWithObjectCompensation(
    objectStorage,
    prepared.objectKey,
    () =>
      getDb().transaction(async (tx) => {
        const [product] = await tx
          .select({ id: products.id, status: products.status })
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1)
          .for("update");
        if (!product) {
          throw new MediaManagementError(
            "Product was removed before media persistence.",
            "PRODUCT_NOT_FOUND",
          );
        }
        if (product.status === "ARCHIVED") {
          throw new MediaManagementError(
            "Product was archived before media persistence.",
            "ARCHIVED_PRODUCT",
          );
        }
        if (variantId) {
          const [variant] = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.id, variantId),
                eq(productVariants.productId, product.id),
              ),
            )
            .limit(1);
          if (!variant) {
            throw new MediaManagementError(
              "Variant no longer belongs to the selected product.",
              "VARIANT_NOT_FOUND",
            );
          }
        }
        const [last] = await tx
          .select({ sortOrder: mediaAssets.sortOrder })
          .from(mediaAssets)
          .where(eq(mediaAssets.productId, product.id))
          .orderBy(desc(mediaAssets.sortOrder), desc(mediaAssets.id))
          .limit(1);
        const [created] = await tx
          .insert(mediaAssets)
          .values({
            productId: product.id,
            variantId,
            ...prepared,
            sortOrder: last ? last.sortOrder + 1 : 0,
          })
          .returning();
        await appendAuditLog(tx, {
          actorId: input.actorId,
          action: "catalog.media.create",
          subjectType: "media-asset",
          subjectId: created.id,
          after: created,
        });
        return created;
      }),
  );
  return { ...asset, publicUrl: objectStorage.publicUrl(asset.objectKey) };
}

export async function listProductMedia(
  productId: string,
  storage?: MediaStorage,
) {
  const parsedProductId = uuid.parse(productId);
  const [product] = await getDb()
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, parsedProductId))
    .limit(1);
  if (!product) {
    throw new MediaManagementError("Product was not found.", "PRODUCT_NOT_FOUND");
  }
  const objectStorage = storage ?? (await getDefaultMediaStorage());
  const rows = await getDb()
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.productId, parsedProductId))
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id));
  return rows.map((row) => ({
    ...row,
    isPrimary: row.sortOrder === 0,
    publicUrl: objectStorage.publicUrl(row.objectKey),
  }));
}

export async function updateMediaAsset(
  rawInput: {
    mediaId: string;
    altText?: string;
    sortOrder?: number;
    actorId: string;
  },
  storage?: MediaStorage,
) {
  const input = z
    .object({
      mediaId: uuid,
      altText: altText.optional(),
      sortOrder: z.number().int().min(0).max(10_000).optional(),
      actorId: z.string().min(1),
    })
    .refine(
      (value) => value.altText !== undefined || value.sortOrder !== undefined,
      "At least one media field must be updated.",
    )
    .parse(rawInput);
  const [candidate] = await getDb()
    .select({ productId: mediaAssets.productId })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, input.mediaId))
    .limit(1);
  if (!candidate) {
    throw new MediaManagementError("Media asset was not found.", "MEDIA_NOT_FOUND");
  }
  const objectStorage = storage ?? (await getDefaultMediaStorage());

  const updated = await getDb().transaction(async (tx) => {
    await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, candidate.productId))
      .limit(1)
      .for("update");
    const rows = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.productId, candidate.productId))
      .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id))
      .for("update");
    const before = rows.find((row) => row.id === input.mediaId);
    if (!before) {
      throw new MediaManagementError("Media asset was not found.", "MEDIA_NOT_FOUND");
    }
    const ordered =
      input.sortOrder === undefined
        ? rows
        : moveMediaToSortOrder(rows, before.id, input.sortOrder);
    for (const [sortOrder, row] of ordered.entries()) {
      const nextAlt = row.id === before.id && input.altText ? input.altText : row.altText;
      if (row.sortOrder !== sortOrder || nextAlt !== row.altText) {
        await tx
          .update(mediaAssets)
          .set({ sortOrder, altText: nextAlt })
          .where(eq(mediaAssets.id, row.id));
      }
    }
    const after = {
      ...before,
      altText: input.altText ?? before.altText,
      sortOrder: ordered.findIndex((row) => row.id === before.id),
    };
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.media.update",
      subjectType: "media-asset",
      subjectId: before.id,
      before,
      after,
    });
    return after;
  });
  return {
    ...updated,
    isPrimary: updated.sortOrder === 0,
    publicUrl: objectStorage.publicUrl(updated.objectKey),
  };
}

export async function deleteMediaAsset(
  rawInput: { mediaId: string; actorId: string },
  storage?: MediaStorage,
) {
  const input = z
    .object({ mediaId: uuid, actorId: z.string().min(1) })
    .parse(rawInput);
  const [candidate] = await getDb()
    .select({ productId: mediaAssets.productId })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, input.mediaId))
    .limit(1);
  if (!candidate) {
    throw new MediaManagementError("Media asset was not found.", "MEDIA_NOT_FOUND");
  }
  const objectStorage = storage ?? (await getDefaultMediaStorage());
  const deleted = await getDb().transaction(async (tx) => {
    await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, candidate.productId))
      .limit(1)
      .for("update");
    const rows = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.productId, candidate.productId))
      .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id))
      .for("update");
    const target = rows.find((row) => row.id === input.mediaId);
    if (!target) {
      throw new MediaManagementError("Media asset was not found.", "MEDIA_NOT_FOUND");
    }
    await tx.delete(mediaAssets).where(eq(mediaAssets.id, target.id));
    const remaining = rows.filter((row) => row.id !== target.id);
    for (const [sortOrder, row] of remaining.entries()) {
      if (row.sortOrder !== sortOrder) {
        await tx
          .update(mediaAssets)
          .set({ sortOrder })
          .where(eq(mediaAssets.id, row.id));
      }
    }
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "catalog.media.delete",
      subjectType: "media-asset",
      subjectId: target.id,
      before: target,
      after: null,
    });
    return target;
  });

  try {
    await objectStorage.deleteObject(deleted.objectKey);
  } catch (error) {
    throw new MediaManagementError(
      `Media record was deleted, but object cleanup failed for ${deleted.objectKey}.`,
      "OBJECT_CLEANUP_FAILED",
      { cause: error, objectKey: deleted.objectKey, databaseDeleted: true },
    );
  }
  return deleted;
}
