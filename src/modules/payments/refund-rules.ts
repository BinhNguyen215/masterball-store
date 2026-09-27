import { createHash } from "node:crypto";

import { canTransition, paymentTransitions } from "@/modules/orders/order-state";

/**
 * Pure rules for money returned to a customer. `paymentTransitions` stays the
 * only owner of payment state changes, so a refund can never invent a status
 * the machine does not allow.
 */
export class PaymentRefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentRefundError";
  }
}

/** A payment the refund path may observe or report. */
export type RefundablePaymentStatus = "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";

/** The statuses a recorded refund can move a payment to. */
export type RefundedPaymentStatus = "PARTIALLY_REFUNDED" | "REFUNDED";

export type RefundablePayment = {
  paymentStatus: string;
  paymentAmountVnd: number;
  /** Every refund already recorded against this payment. */
  alreadyRefundedVnd: number;
};

const REFUNDABLE_STATUSES: readonly string[] = ["PAID", "PARTIALLY_REFUNDED"];

/** How much of the payment can still be returned, 0 when nothing is refundable. */
export function refundableBalance(input: RefundablePayment): number {
  if (!REFUNDABLE_STATUSES.includes(input.paymentStatus)) return 0;
  return Math.max(0, input.paymentAmountVnd - input.alreadyRefundedVnd);
}

/**
 * Stable key for the refund row. The same payment refunded by the same amount
 * for the same caller-supplied reference is one refund, so a double submit
 * replays the recorded result instead of paying the customer twice.
 */
export function refundIdempotencyKey(input: {
  paymentId: string;
  amountVnd: number;
  reference: string;
}): string {
  return createHash("sha256")
    .update(`payment-refund:${input.paymentId}:${input.amountVnd}:${input.reference}`)
    .digest("hex");
}

/**
 * Validates a refund and returns the state it implies. Throws when the payment
 * is not refundable, when the amount is not a positive whole number of VND, or
 * when it exceeds what is still refundable.
 */
export function planRefund(
  input: RefundablePayment & { amountVnd: number },
): {
  nextPaymentStatus: RefundedPaymentStatus;
  refundableVndAfter: number;
  refundedVndAfter: number;
} {
  if (!REFUNDABLE_STATUSES.includes(input.paymentStatus)) {
    throw new PaymentRefundError("Only a paid payment can be refunded.");
  }
  if (!Number.isSafeInteger(input.amountVnd) || input.amountVnd <= 0) {
    throw new PaymentRefundError(
      "A refund amount must be a positive whole number of VND.",
    );
  }
  const refundableVnd = refundableBalance(input);
  if (input.amountVnd > refundableVnd) {
    throw new PaymentRefundError(
      `The refund exceeds the refundable balance of ${refundableVnd} VND.`,
    );
  }
  const refundedVndAfter = input.alreadyRefundedVnd + input.amountVnd;
  const nextPaymentStatus: RefundedPaymentStatus =
    refundedVndAfter < input.paymentAmountVnd ? "PARTIALLY_REFUNDED" : "REFUNDED";
  if (!canTransition(paymentTransitions, input.paymentStatus, nextPaymentStatus)) {
    throw new PaymentRefundError(
      `Payment cannot transition from ${input.paymentStatus} to ${nextPaymentStatus}.`,
    );
  }
  return {
    nextPaymentStatus,
    refundableVndAfter: refundableVnd - input.amountVnd,
    refundedVndAfter,
  };
}