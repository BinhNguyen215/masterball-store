import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { productReviews, products, reviewStatusEnum } from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";
import { findOrderIdByContact } from "@/modules/orders";

export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];

/** Moderation is reserved to the admin console, so every failure is typed. */
export class ReviewError extends Error {
  constructor(
    message: string,
    readonly code: "ORDER_NOT_FOUND" | "DUPLICATE" | "INVALID" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

/** Mirrors `product_reviews_author_check` and `product_reviews_body_check`. */
export const REVIEW_AUTHOR_MIN_LENGTH = 2;
export const REVIEW_AUTHOR_MAX_LENGTH = 120;
export const REVIEW_BODY_MIN_LENGTH = 10;
export const REVIEW_BODY_MAX_LENGTH = 2000;

/** Page bounds shared by the storefront list and the moderation queue. */
const STOREFRONT_PAGE_SIZE = 10;
const STOREFRONT_MAX_PAGE_SIZE = 50;
const ADMIN_PAGE_SIZE = 50;
const ADMIN_MAX_PAGE_SIZE = 200;
/** Mirrors the `note` bound on the console's own `reviewMutationSchema`. */
const REVIEW_NOTE_MAX_LENGTH = 240;

/**
 * Pure guards for the review form. They mirror the database checks so a bad
 * submission fails with a typed error instead of a constraint violation, and
 * they are what the storefront and the tests reach without a database.
 */
export function isValidReviewRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isValidReviewAuthorName(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= REVIEW_AUTHOR_MIN_LENGTH &&
    trimmed.length <= REVIEW_AUTHOR_MAX_LENGTH
  );
}

export function isValidReviewBody(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= REVIEW_BODY_MIN_LENGTH &&
    trimmed.length <= REVIEW_BODY_MAX_LENGTH
  );
}

/** One review as the storefront and the console render it, product resolved. */
export type ReviewRow = {
  id: string;
  productId: string;
  productTitle: string;
  orderId: string | null;
  authorName: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const identifierSchema = z.string().uuid();
const statusFilterSchema = z.enum(reviewStatusEnum.enumValues);
const targetStatusSchema = z.enum(["PUBLISHED", "REJECTED"]);

const submitReviewSchema = z.object({
  productId: identifierSchema,
  orderNumber: z.string().trim().min(1).max(40),
  phone: z.string().trim().min(1).max(40),
  authorName: z.string().trim().min(REVIEW_AUTHOR_MIN_LENGTH).max(REVIEW_AUTHOR_MAX_LENGTH),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(REVIEW_BODY_MIN_LENGTH).max(REVIEW_BODY_MAX_LENGTH),
});

const reviewSelection = {
  id: productReviews.id,
  productId: productReviews.productId,
  productTitle: products.title,
  orderId: productReviews.orderId,
  authorName: productReviews.authorName,
  rating: productReviews.rating,
  body: productReviews.body,
  status: productReviews.status,
  moderatedBy: productReviews.moderatedBy,
  moderatedAt: productReviews.moderatedAt,
  publishedAt: productReviews.publishedAt,
  createdAt: productReviews.createdAt,
  updatedAt: productReviews.updatedAt,
};

/** The storefront only ever reads a review whose `published_at` is stamped. */
const publishedCondition = eq(productReviews.status, "PUBLISHED");

/**
 * Submits a review for one purchased product. The buyer is proved by the order
 * number and the phone number used at checkout, so nothing but verified
 * purchases reach the moderation queue; the row always lands as PENDING and a
 * second review of the same product in the same order is reported, never
 * written twice.
 */
export async function submitProductReview(input: {
  productId: string;
  orderNumber: string;
  phone: string;
  authorName: string;
  rating: number;
  body: string;
  now?: Date;
}): Promise<{ id: string }> {
  const parsed = submitReviewSchema.safeParse({
    productId: input.productId,
    orderNumber: input.orderNumber,
    phone: input.phone,
    authorName: input.authorName,
    rating: input.rating,
    body: input.body,
  });
  if (!parsed.success) {
    throw new ReviewError("The review details are not valid.", "INVALID");
  }
  const now = input.now ?? new Date();

  const orderId = await findOrderIdByContact({
    orderNumber: parsed.data.orderNumber,
    phone: parsed.data.phone,
  });
  if (!orderId) {
    throw new ReviewError(
      "No order matches that order number and phone number.",
      "ORDER_NOT_FOUND",
    );
  }

  return getDb().transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, parsed.data.productId))
      .limit(1);
    if (!product) {
      throw new ReviewError("The reviewed product was not found.", "NOT_FOUND");
    }

    // `product_reviews_order_product_unique` is the duplicate guard; letting the
    // insert conflict keeps the check atomic with the write it protects.
    const [row] = await tx
      .insert(productReviews)
      .values({
        productId: parsed.data.productId,
        orderId,
        authorName: parsed.data.authorName,
        rating: parsed.data.rating,
        body: parsed.data.body,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [productReviews.orderId, productReviews.productId],
      })
      .returning({ id: productReviews.id });

    if (!row) {
      throw new ReviewError(
        "This order already reviewed that product.",
        "DUPLICATE",
      );
    }

    await appendAuditLog(tx, {
      actorId: null,
      action: "review.submit",
      subjectType: "product_review",
      subjectId: row.id,
      before: null,
      after: {
        productId: parsed.data.productId,
        orderId,
        rating: parsed.data.rating,
        status: "PENDING",
      },
    });

    return { id: row.id };
  });
}

/**
 * Public rating for one product. Reads only published reviews, and reports a
 * `null` average when there is nothing to average instead of a misleading zero.
 * A malformed identifier matches no review rather than reaching the driver.
 */
export async function getProductReviewSummary(
  productId: string,
): Promise<{ averageRating: number | null; reviewCount: number }> {
  const parsed = identifierSchema.safeParse(productId);
  if (!parsed.success) return { averageRating: null, reviewCount: 0 };

  const [row] = await getDb()
    .select({
      reviewCount: count(),
      averageRating: sql<string | null>`avg(${productReviews.rating})`,
    })
    .from(productReviews)
    .where(and(eq(productReviews.productId, parsed.data), publishedCondition));

  const average = row?.averageRating === null || row?.averageRating === undefined
    ? null
    : Number(row.averageRating);
  return {
    averageRating: average !== null && Number.isFinite(average) ? average : null,
    reviewCount: Number(row?.reviewCount ?? 0),
  };
}

/** Published reviews of one product, newest first, for the storefront list. */
export async function listPublishedProductReviews(
  productId: string,
  input: { limit?: number; offset?: number } = {},
): Promise<{ items: ReviewRow[]; total: number }> {
  const parsed = identifierSchema.safeParse(productId);
  if (!parsed.success) return { items: [], total: 0 };

  const limit = Math.max(1, Math.min(STOREFRONT_MAX_PAGE_SIZE, input.limit ?? STOREFRONT_PAGE_SIZE));
  const offset = Math.max(0, input.offset ?? 0);
  const where = and(eq(productReviews.productId, parsed.data), publishedCondition);

  // The pair of queries is one page and its exact total: the storefront renders
  // the total as a count, so it cannot stop at a bounded approximation.
  const [rows, [totalRow]] = await Promise.all([
    getDb()
      .select(reviewSelection)
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .where(where)
      .orderBy(desc(productReviews.createdAt), desc(productReviews.id))
      .limit(limit)
      .offset(offset),
    getDb()
      .select({ count: count() })
      .from(productReviews)
      .where(where),
  ]);

  return { items: rows, total: Number(totalRow?.count ?? 0) };
}

/**
 * Paged moderation listing. An unknown status matches nothing instead of
 * raising, so a stale filter link renders an empty table; the queue is ordered
 * oldest first so a review cannot starve behind newer submissions. The total is
 * exact because the console prints it as the published counter.
 */
export async function listAdminProductReviews(
  input: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ items: ReviewRow[]; total: number }> {
  const limit = Math.max(1, Math.min(ADMIN_MAX_PAGE_SIZE, input.limit ?? ADMIN_PAGE_SIZE));
  const offset = Math.max(0, input.offset ?? 0);
  const conditions: SQL[] = [];

  if (input.status?.trim()) {
    const status = statusFilterSchema.safeParse(input.status.trim());
    conditions.push(status.success ? eq(productReviews.status, status.data) : sql`false`);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    getDb()
      .select(reviewSelection)
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .where(where)
      .orderBy(asc(productReviews.createdAt), asc(productReviews.id))
      .limit(limit)
      .offset(offset),
    getDb().select({ count: count() }).from(productReviews).where(where),
  ]);

  return { items: rows, total: Number(totalRow?.count ?? 0) };
}

/**
 * Publishes or rejects one review. Publishing stamps `published_at` once, so a
 * review that is rejected and later published keeps its original first-publish
 * instant; rejecting clears it because the row is no longer public. The
 * moderator and the decision time are recorded, and the rejection note is kept
 * in the audit entry — the review row itself has no note column.
 */
export async function setReviewStatus(input: {
  reviewId: string;
  status: "PUBLISHED" | "REJECTED";
  actorId: string;
  note?: string | null;
}): Promise<void> {
  const reviewId = identifierSchema.safeParse(input.reviewId);
  const status = targetStatusSchema.safeParse(input.status);
  const actorId = typeof input.actorId === "string" ? input.actorId.trim() : "";
  if (!reviewId.success || !status.success || !actorId) {
    throw new ReviewError("The review decision is not valid.", "INVALID");
  }
  const note = input.note?.trim()
    ? input.note.trim().slice(0, REVIEW_NOTE_MAX_LENGTH)
    : null;
  const now = new Date();

  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(productReviews)
      .where(eq(productReviews.id, reviewId.data))
      .limit(1)
      .for("update");
    if (!before) {
      throw new ReviewError("The review was not found.", "NOT_FOUND");
    }

    const [after] = await tx
      .update(productReviews)
      .set({
        status: status.data,
        publishedAt:
          status.data === "PUBLISHED" ? (before.publishedAt ?? now) : null,
        moderatedBy: actorId,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(eq(productReviews.id, before.id))
      .returning();

    await appendAuditLog(tx, {
      actorId,
      action: status.data === "PUBLISHED" ? "review.publish" : "review.reject",
      subjectType: "product_review",
      subjectId: before.id,
      before: {
        status: before.status,
        publishedAt: before.publishedAt,
        moderatedBy: before.moderatedBy,
        moderatedAt: before.moderatedAt,
      },
      after: {
        status: after.status,
        publishedAt: after.publishedAt,
        moderatedBy: after.moderatedBy,
        moderatedAt: after.moderatedAt,
        note,
      },
    });
  });
}
