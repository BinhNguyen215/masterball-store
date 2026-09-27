import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { orders, orderStatusHistory, paymentRefunds, payments } from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

import {
  PaymentRefundError,
  planRefund,
  refundIdempotencyKey,
  type RefundablePaymentStatus,
} from "./refund-rules";

export type PaymentRefundResult = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  refundId: string;
  paymentStatus: RefundablePaymentStatus;
  refundedVnd: number;
  /** True when an identical refund was already recorded. */
  replayed: boolean;
};

/**
 * Records money returned against a paid payment. The provider transfer happens
 * out of band (the operator makes it in the bank app), so this writes the
 * ledger the console reconciles against: the refund row, the payment status,
 * the order mirror, the payment history, and the audit entry — one transaction
 * with the payment row locked.
 *
 * `reference` is the caller-supplied part of the idempotency key; when the
 * caller has nothing better it defaults to the reason text, so a double submit
 * of the same refund replays instead of paying twice.
 */
export async function refundPayment(input: {
  paymentId: string;
  amountVnd: number;
  reason: string;
  actorId: string;
  reference?: string;
}): Promise<PaymentRefundResult> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new PaymentRefundError("A refund reason of at least 3 characters is required.");
  }
  const idempotencyKey = refundIdempotencyKey({
    paymentId: input.paymentId,
    amountVnd: input.amountVnd,
    reference: input.reference?.trim() || reason,
  });

  return getDb().transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: payments.id, orderId: payments.orderId })
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .limit(1);
    if (!candidate) throw new PaymentRefundError("Payment was not found.");

    // Every other payment mutation (IPN, expiry, cash settlement) takes the
    // order lock before the payment lock; keeping that order avoids a
    // payment↔order lock inversion deadlock.
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, candidate.orderId))
      .limit(1)
      .for("update");
    if (!order) throw new PaymentRefundError("The order of this payment was not found.");
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, candidate.id))
      .limit(1)
      .for("update");
    if (!payment) throw new PaymentRefundError("Payment was not found.");

    const [alreadyRefunded] = await tx
      .select({
        refundedVnd: sql<number>`coalesce(sum(${paymentRefunds.amountVnd}), 0)::int`,
      })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, payment.id));
    const refundedVnd = Number(alreadyRefunded?.refundedVnd ?? 0);
    const [existing] = await tx
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existing) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        paymentStatus: payment.status as RefundablePaymentStatus,
        refundId: existing.id,
        refundedVnd,
        replayed: true,
      };
    }

    const plan = planRefund({
      alreadyRefundedVnd: refundedVnd,
      amountVnd: input.amountVnd,
      paymentAmountVnd: payment.amountVnd,
      paymentStatus: payment.status,
    });

    const now = new Date();
    const [refund] = await tx
      .insert(paymentRefunds)
      .values({
        paymentId: payment.id,
        idempotencyKey,
        amountVnd: input.amountVnd,
        // The money left through the operator's bank or gateway account; no
        // provider reference is authoritative here, so the ledger stays empty
        // rather than inventing one.
        providerReference: null,
        status: "SUCCEEDED",
        reason,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: paymentRefunds.idempotencyKey })
      .returning({ id: paymentRefunds.id });
    if (!refund) {
      // A concurrent request recorded the same refund first; report that one.
      const [winner] = await tx
        .select({ id: paymentRefunds.id })
        .from(paymentRefunds)
        .where(eq(paymentRefunds.idempotencyKey, idempotencyKey))
        .limit(1);
      if (!winner) {
        throw new PaymentRefundError("The refund could not be recorded.");
      }
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        paymentStatus: payment.status as RefundablePaymentStatus,
        refundId: winner.id,
        refundedVnd,
        replayed: true,
      };
    }

    await tx
      .update(payments)
      .set({ status: plan.nextPaymentStatus, updatedAt: now })
      .where(eq(payments.id, payment.id));
    await tx
      .update(orders)
      .set({
        paymentStatus: plan.nextPaymentStatus,
        version: sql`${orders.version} + 1`,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      actorId: input.actorId,
      dimension: "PAYMENT",
      fromStatus: payment.status,
      toStatus: plan.nextPaymentStatus,
      reason,
    });
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "payment.refund",
      subjectType: "payment",
      subjectId: payment.id,
      before: {
        paymentStatus: payment.status,
        refundedVnd,
      },
      after: {
        paymentStatus: plan.nextPaymentStatus,
        amountVnd: input.amountVnd,
        orderNumber: order.orderNumber,
        refundedVnd: plan.refundedVndAfter,
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      paymentStatus: plan.nextPaymentStatus,
      refundId: refund.id,
      refundedVnd: plan.refundedVndAfter,
      replayed: false,
    };
  });
}