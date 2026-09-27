import { and, count, desc, eq, ilike, sql } from "drizzle-orm";

import { getDb, type AppTransaction } from "@/db";
import { couponRedemptions, coupons } from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

export class CouponError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INACTIVE"
      | "NOT_STARTED"
      | "EXPIRED"
      | "MIN_ORDER"
      | "EXHAUSTED"
      | "INVALID",
  ) {
    super(message);
    this.name = "CouponError";
  }
}

export type CouponRow = typeof coupons.$inferSelect;
export type CouponKind = CouponRow["kind"];
export type CouponStatus = CouponRow["status"];

const ADMIN_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * The discount a coupon grants for one basket. Deliberately pure: the same
 * arithmetic backs the storefront preview and the checkout total, so a code
 * cannot promise the customer one number and charge another. `shippingVnd`
 * participates because a fixed-value code may legitimately cover delivery.
 */
export function discountForCoupon(
  coupon: { kind: CouponKind; value: number; maxDiscountVnd: number | null },
  subtotalVnd: number,
  shippingVnd: number,
): number {
  const basketVnd = Math.max(0, Math.floor(subtotalVnd) + Math.floor(shippingVnd));
  const raw =
    coupon.kind === "PERCENT"
      ? Math.floor((subtotalVnd * coupon.value) / 100)
      : Math.min(coupon.value, basketVnd);
  const capped =
    coupon.maxDiscountVnd === null ? raw : Math.min(raw, coupon.maxDiscountVnd);
  if (!Number.isFinite(capped)) return 0;
  return Math.max(0, Math.min(capped, basketVnd));
}

/**
 * Validates a code against the locked row and returns the discount it would
 * grant, without writing anything. Locking here is what makes `redeemCoupon`
 * safe in the same transaction: the usage ceiling cannot be raced.
 */
export async function resolveCouponForOrder(
  tx: AppTransaction,
  input: { code: string; subtotalVnd: number; shippingVnd: number; now: Date },
): Promise<{ couponId: string; discountVnd: number }> {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new CouponError("A discount code is required.", "INVALID");

  const [coupon] = await tx
    .select()
    .from(coupons)
    .where(eq(coupons.code, code))
    .limit(1)
    .for("update");
  if (!coupon) {
    throw new CouponError(`Discount code "${code}" does not exist.`, "NOT_FOUND");
  }
  if (coupon.status !== "ACTIVE") {
    throw new CouponError(`Discount code "${code}" is paused.`, "INACTIVE");
  }
  if (coupon.startsAt && input.now < coupon.startsAt) {
    throw new CouponError(`Discount code "${code}" has not started yet.`, "NOT_STARTED");
  }
  if (coupon.endsAt && input.now >= coupon.endsAt) {
    throw new CouponError(`Discount code "${code}" has expired.`, "EXPIRED");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponError(`Discount code "${code}" has no uses left.`, "EXHAUSTED");
  }
  if (input.subtotalVnd < coupon.minOrderVnd) {
    throw new CouponError(
      `Discount code "${code}" requires a subtotal of at least ${coupon.minOrderVnd} VND.`,
      "MIN_ORDER",
    );
  }

  const discountVnd = discountForCoupon(
    coupon,
    input.subtotalVnd,
    input.shippingVnd,
  );
  // `orders_coupon_check` refuses a coupon reference without a positive
  // discount, so a code that grants nothing for this basket is not applicable.
  if (discountVnd <= 0) {
    throw new CouponError(
      `Discount code "${code}" grants no discount for this order.`,
      "INVALID",
    );
  }
  return { couponId: coupon.id, discountVnd };
}

/**
 * Consumes one use of an already-resolved coupon. The redemption row is unique
 * per order, so a retried checkout cannot spend the same code twice.
 */
export async function redeemCoupon(
  tx: AppTransaction,
  input: { couponId: string; orderId: string; amountVnd: number },
): Promise<void> {
  if (!Number.isInteger(input.amountVnd) || input.amountVnd <= 0) {
    throw new CouponError(
      "A redemption must record a positive integer discount.",
      "INVALID",
    );
  }

  const [coupon] = await tx
    .select()
    .from(coupons)
    .where(eq(coupons.id, input.couponId))
    .limit(1)
    .for("update");
  if (!coupon) {
    throw new CouponError("The discount code no longer exists.", "NOT_FOUND");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponError("The discount code has no uses left.", "EXHAUSTED");
  }

  const [redemption] = await tx
    .insert(couponRedemptions)
    .values({
      couponId: input.couponId,
      orderId: input.orderId,
      amountVnd: input.amountVnd,
    })
    .onConflictDoNothing({ target: couponRedemptions.orderId })
    .returning({ id: couponRedemptions.id });
  if (!redemption) return;

  await tx
    .update(coupons)
    .set({
      usedCount: sql`${coupons.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, input.couponId));
}

export async function listAdminCoupons(
  input: { status?: string; q?: string; limit?: number; offset?: number } = {},
): Promise<{ items: CouponRow[]; total: number }> {
  const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(input.limit ?? ADMIN_PAGE_SIZE)));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const conditions = [
    input.status === "ACTIVE" || input.status === "DISABLED"
      ? eq(coupons.status, input.status)
      : undefined,
    input.q?.trim() ? ilike(coupons.code, `%${input.q.trim().toUpperCase()}%`) : undefined,
  ].filter((condition) => condition !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
      .select()
      .from(coupons)
      .where(where)
      .orderBy(desc(coupons.createdAt), desc(coupons.id))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(coupons).where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}

export async function createCoupon(
  input: {
    code: string;
    kind: CouponKind;
    value: number;
    minOrderVnd: number;
    maxDiscountVnd?: number | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    usageLimit?: number | null;
    note?: string | null;
  },
  actorId: string,
): Promise<void> {
  const code = input.code.trim().toUpperCase();
  const maxDiscountVnd = input.maxDiscountVnd ?? null;
  const usageLimit = input.usageLimit ?? null;
  const startsAt = input.startsAt ?? null;
  const endsAt = input.endsAt ?? null;

  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    throw new CouponError(
      "Coupon codes use 3–32 characters: letters, digits, hyphen, underscore.",
      "INVALID",
    );
  }
  if (!Number.isInteger(input.value) || input.value <= 0) {
    throw new CouponError("A coupon value must be a positive integer.", "INVALID");
  }
  if (input.kind === "PERCENT" && input.value > 100) {
    throw new CouponError("A percentage coupon cannot exceed 100%.", "INVALID");
  }
  if (!Number.isInteger(input.minOrderVnd) || input.minOrderVnd < 0) {
    throw new CouponError("The minimum order must be zero or more VND.", "INVALID");
  }
  if (maxDiscountVnd !== null && (!Number.isInteger(maxDiscountVnd) || maxDiscountVnd <= 0)) {
    throw new CouponError("A discount cap must be a positive integer.", "INVALID");
  }
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
    throw new CouponError("A usage limit must be a positive integer.", "INVALID");
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new CouponError("The coupon window must end after it starts.", "INVALID");
  }

  return getDb().transaction(async (tx) => {
    const created = await insertCouponRow(tx, {
      code,
      kind: input.kind,
      value: input.value,
      minOrderVnd: input.minOrderVnd,
      maxDiscountVnd,
      startsAt,
      endsAt,
      usageLimit,
      note: input.note?.trim() || null,
    });

    await appendAuditLog(tx, {
      actorId,
      action: "coupon.create",
      subjectType: "coupon",
      subjectId: created.id,
      after: created,
    });
  });
}

export async function setCouponStatus(input: {
  couponId: string;
  expectedVersion: number;
  status: CouponStatus;
  actorId: string;
}): Promise<void> {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(coupons)
      .where(eq(coupons.id, input.couponId))
      .limit(1)
      .for("update");
    if (!before) {
      throw new CouponError("The discount code was not found.", "NOT_FOUND");
    }
    if (before.version !== input.expectedVersion) {
      throw new CouponError(
        "The discount code was changed by another request.",
        "INVALID",
      );
    }

    const [after] = await tx
      .update(coupons)
      .set({
        status: input.status,
        version: sql`${coupons.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, input.couponId))
      .returning();

    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "coupon.status",
      subjectType: "coupon",
      subjectId: before.id,
      before,
      after,
    });
  });
}

/**
 * Inserts one coupon, translating the database's own refusals into domain
 * errors. The unique index stays the authority on duplicate codes rather than
 * a read-then-write race in application code.
 */
async function insertCouponRow(
  tx: AppTransaction,
  values: typeof coupons.$inferInsert,
): Promise<CouponRow> {
  try {
    const [row] = await tx.insert(coupons).values(values).returning();
    return row;
  } catch (error) {
    const pgCode = pgErrorCode(error);
    if (pgCode === "23505") {
      throw new CouponError(`Coupon code "${values.code}" already exists.`, "INVALID");
    }
    if (pgCode === "23514") {
      throw new CouponError(
        `Coupon "${values.code}" breaches a stored coupon rule.`,
        "INVALID",
      );
    }
    throw error;
  }
}

/** PostgreSQL `code` values, unwrapping the driver's error chain. */
function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
