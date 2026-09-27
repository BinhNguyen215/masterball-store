import { describe, expect, it } from "vitest";

import {
  PaymentRefundError,
  planRefund,
  refundableBalance,
  refundIdempotencyKey,
} from "@/modules/payments/refund-rules";

const paid = {
  alreadyRefundedVnd: 0,
  paymentAmountVnd: 230_000,
  paymentStatus: "PAID",
};

describe("payment refund rules", () => {
  it("keeps the payment refundable balance in step with what was returned", () => {
    expect(refundableBalance(paid)).toBe(230_000);
    expect(refundableBalance({ ...paid, alreadyRefundedVnd: 30_000 })).toBe(200_000);
    expect(refundableBalance({ ...paid, alreadyRefundedVnd: 230_000 })).toBe(0);
  });

  it("refuses to refund money that was never collected", () => {
    for (const status of ["UNPAID", "PENDING", "FAILED", "REFUNDED", "MANUAL_REVIEW"]) {
      expect(refundableBalance({ ...paid, paymentStatus: status })).toBe(0);
      expect(() => planRefund({ ...paid, amountVnd: 1_000, paymentStatus: status })).toThrow(
        PaymentRefundError,
      );
    }
  });

  it("rejects a refund above the remaining balance", () => {
    expect(() =>
      planRefund({ ...paid, alreadyRefundedVnd: 200_000, amountVnd: 30_001 }),
    ).toThrow(/exceeds the refundable balance/);
    expect(planRefund({ ...paid, alreadyRefundedVnd: 200_000, amountVnd: 30_000 })).toMatchObject(
      { nextPaymentStatus: "REFUNDED" },
    );
  });

  it("rejects amounts that are not positive whole VND", () => {
    for (const amountVnd of [0, -1, 1.5, Number.NaN]) {
      expect(() => planRefund({ ...paid, amountVnd })).toThrow(PaymentRefundError);
    }
  });

  it("only reports the payment fully refunded when nothing is left", () => {
    expect(planRefund({ ...paid, amountVnd: 1 })).toMatchObject({
      nextPaymentStatus: "PARTIALLY_REFUNDED",
      refundableVndAfter: 229_999,
      refundedVndAfter: 1,
    });
    expect(planRefund({ ...paid, amountVnd: 230_000 })).toMatchObject({
      nextPaymentStatus: "REFUNDED",
      refundableVndAfter: 0,
      refundedVndAfter: 230_000,
    });
  });

  it("lets a partially refunded payment be refunded again", () => {
    const partially = { ...paid, alreadyRefundedVnd: 100_000, paymentStatus: "PARTIALLY_REFUNDED" };

    expect(planRefund({ ...partially, amountVnd: 50_000 })).toMatchObject({
      nextPaymentStatus: "PARTIALLY_REFUNDED",
    });
    expect(planRefund({ ...partially, amountVnd: 130_000 })).toMatchObject({
      nextPaymentStatus: "REFUNDED",
    });
  });

  it("derives one stable key per payment, amount and reference", () => {
    const base = { paymentId: "11111111-1111-4111-8111-111111111111", amountVnd: 50_000 };

    const first = refundIdempotencyKey({ ...base, reference: "transfer-8841" });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(refundIdempotencyKey({ ...base, reference: "transfer-8841" }));
    expect(first).not.toBe(refundIdempotencyKey({ ...base, reference: "transfer-8842" }));
    expect(first).not.toBe(refundIdempotencyKey({ ...base, amountVnd: 50_001, reference: "transfer-8841" }));
    expect(first).not.toBe(
      refundIdempotencyKey({
        ...base,
        paymentId: "22222222-2222-4222-8222-222222222222",
        reference: "transfer-8841",
      }),
    );
  });
});
