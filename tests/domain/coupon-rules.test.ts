import { describe, expect, it } from "vitest";

import type { AppTransaction } from "@/db";
import {
  CouponError,
  discountForCoupon,
  resolveCouponForOrder,
} from "@/modules/coupons";

/**
 * The resolver only reads one locked coupon row, so a minimal chain that
 * yields it exercises the real branching without a database.
 */
function stubTransaction(row: Record<string, unknown> | null): AppTransaction {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    for: () => Promise.resolve(row ? [row] : []),
  };
  return { select: () => chain } as unknown as AppTransaction;
}

function couponRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    code: "TCG50",
    kind: "PERCENT" as const,
    value: 50,
    minOrderVnd: 0,
    maxDiscountVnd: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usedCount: 0,
    status: "ACTIVE" as const,
    note: null,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const now = new Date("2026-03-01T00:00:00Z");

describe("coupon discount maths", () => {
  it("takes a percentage of the subtotal and floors the fraction", () => {
    expect(
      discountForCoupon({ kind: "PERCENT", value: 50, maxDiscountVnd: null }, 200_000, 30_000),
    ).toBe(100_000);
    expect(
      discountForCoupon({ kind: "PERCENT", value: 10, maxDiscountVnd: null }, 99_999, 0),
    ).toBe(9_999);
  });

  it("caps a percentage coupon at its maximum discount", () => {
    expect(
      discountForCoupon({ kind: "PERCENT", value: 50, maxDiscountVnd: 30_000 }, 200_000, 0),
    ).toBe(30_000);
    expect(
      discountForCoupon({ kind: "PERCENT", value: 50, maxDiscountVnd: 300_000 }, 200_000, 0),
    ).toBe(100_000);
  });

  it("caps a fixed coupon at the whole basket including shipping", () => {
    expect(
      discountForCoupon({ kind: "FIXED", value: 500_000, maxDiscountVnd: null }, 100_000, 20_000),
    ).toBe(120_000);
    expect(
      discountForCoupon({ kind: "FIXED", value: 15_000, maxDiscountVnd: null }, 100_000, 20_000),
    ).toBe(15_000);
  });

  it("grants nothing for an empty subtotal and never exceeds the basket", () => {
    expect(
      discountForCoupon({ kind: "PERCENT", value: 100, maxDiscountVnd: null }, 0, 0),
    ).toBe(0);
    expect(
      discountForCoupon({ kind: "FIXED", value: 50_000, maxDiscountVnd: null }, 0, 20_000),
    ).toBe(20_000);
    for (const subtotal of [0, 1, 500_000]) {
      const discount = discountForCoupon(
        { kind: "PERCENT", value: 100, maxDiscountVnd: null },
        subtotal,
        25_000,
      );
      expect(discount).toBeGreaterThanOrEqual(0);
      expect(discount).toBeLessThanOrEqual(subtotal + 25_000);
    }
  });
});

describe("coupon resolution minimum-order boundary", () => {
  it("accepts a subtotal exactly at the minimum", async () => {
    const tx = stubTransaction(couponRow({ minOrderVnd: 200_000 }));
    await expect(
      resolveCouponForOrder(tx, { code: "tcg50", subtotalVnd: 200_000, shippingVnd: 0, now }),
    ).resolves.toEqual({
      couponId: "11111111-1111-1111-1111-111111111111",
      discountVnd: 100_000,
    });
  });

  it("rejects one VND below the minimum", async () => {
    const tx = stubTransaction(couponRow({ minOrderVnd: 200_000 }));
    await expect(
      resolveCouponForOrder(tx, { code: "TCG50", subtotalVnd: 199_999, shippingVnd: 0, now }),
    ).rejects.toMatchObject({ code: "MIN_ORDER" });
  });

  it("names the reason a code cannot be used", async () => {
    const cases: [Record<string, unknown>, string, number?][] = [
      [{ status: "DISABLED" }, "INACTIVE"],
      [{ startsAt: new Date("2026-04-01T00:00:00Z") }, "NOT_STARTED"],
      [{ endsAt: new Date("2026-02-01T00:00:00Z") }, "EXPIRED"],
      [{ usageLimit: 3, usedCount: 3 }, "EXHAUSTED"],
      // 1% of a 50 VND basket floors to nothing, so the code is not applicable.
      [{ value: 1 }, "INVALID", 50],
    ];
    for (const [overrides, code, subtotalVnd = 100] of cases) {
      const rejection = resolveCouponForOrder(stubTransaction(couponRow(overrides)), {
        code: "TCG50",
        subtotalVnd,
        shippingVnd: 0,
        now,
      });
      await expect(rejection).rejects.toBeInstanceOf(CouponError);
      await expect(rejection).rejects.toMatchObject({ code });
    }
  });

  it("reports an unknown code", async () => {
    await expect(
      resolveCouponForOrder(stubTransaction(null), {
        code: " nope ",
        subtotalVnd: 100_000,
        shippingVnd: 0,
        now,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
