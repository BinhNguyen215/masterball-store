import { createHash, randomBytes } from "node:crypto";

import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import {
  orderAddresses,
  orders,
  orderStatusHistory,
  paymentEvents,
  payments,
} from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";
import { enqueueEmail } from "@/modules/email";
import {
  commitInventoryReservation,
  hasActiveInventoryReservation,
  releaseInventoryReservation,
} from "@/modules/inventory";

import { getVnpayConfig, type VnpayConfig } from "./vnpay-adapter";
import {
  canonicalizeVnpayParameters,
  verifyVnpaySignature,
  type VnpayParameters,
} from "./vnpay-signature";
import { queryVnpayTransaction } from "./vnpay-query";

export type VnpayIpnResponse = { RspCode: string; Message: string };

function stringParameters(input: URLSearchParams | VnpayParameters): Record<string, string> {
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries());
  return Object.fromEntries(
    Object.entries(input)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function parseAmountVnd(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const scaled = Number(value);
  if (!Number.isSafeInteger(scaled) || scaled % 100 !== 0) return null;
  return scaled / 100;
}

export function createVnpayEventId(params: Record<string, string>): string {
  const transaction = params.vnp_TransactionNo;
  const suffix = transaction || createHash("sha256")
    .update(canonicalizeVnpayParameters(params))
    .digest("hex");
  return `${params.vnp_TxnRef}:${suffix}:${params.vnp_Amount}:${params.vnp_ResponseCode}:${params.vnp_TransactionStatus}`;
}

async function applyTrustedVnpayResult(
  rawInput: URLSearchParams | VnpayParameters,
  eventKind: "IPN" | "RECONCILIATION",
  actorId?: string | null,
): Promise<VnpayIpnResponse> {
  const params = stringParameters(rawInput);
  const reference = params.vnp_TxnRef;
  const amountVnd = parseAmountVnd(params.vnp_Amount);
  if (!reference) return { RspCode: "01", Message: "Order not found" };
  if (amountVnd === null) return { RspCode: "04", Message: "Invalid amount" };

  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${reference}, 0))`);
    const [paymentCandidate] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.provider, "VNPAY"),
          eq(payments.providerReference, reference),
        ),
      )
      .limit(1);
    if (!paymentCandidate) return { RspCode: "01", Message: "Order not found" };

    // Expiry, admin transitions, and IPN all acquire the order lock first.
    // Keeping this order avoids a payment↔order lock inversion deadlock.
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, paymentCandidate.orderId))
      .limit(1)
      .for("update");
    if (!order) return { RspCode: "01", Message: "Order not found" };
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentCandidate.id))
      .limit(1)
      .for("update");
    if (!payment) return { RspCode: "01", Message: "Order not found" };
    const auditReconciliation = async (after: Record<string, unknown>) => {
      if (eventKind !== "RECONCILIATION") return;
      await appendAuditLog(tx, {
        actorId: actorId ?? null,
        action: "payment.reconcile",
        subjectType: "payment",
        subjectId: payment.id,
        before: {
          orderStatus: order.orderStatus,
          paymentStatus: payment.status,
          providerTransactionId: payment.providerTransactionId,
        },
        after,
      });
    };

    const [insertedEvent] = await tx
      .insert(paymentEvents)
      .values({
        paymentId: payment.id,
        provider: "VNPAY",
        eventKind,
        providerEventId: createVnpayEventId(params),
        providerTransactionId: params.vnp_TransactionNo ?? null,
        responseCode: params.vnp_ResponseCode ?? null,
        transactionStatus: params.vnp_TransactionStatus ?? null,
        amountVnd,
        payload: params,
      })
      .onConflictDoNothing({
        target: [paymentEvents.provider, paymentEvents.providerEventId],
      })
      .returning({ id: paymentEvents.id });
    if (!insertedEvent) {
      return payment.amountVnd === amountVnd
        ? { RspCode: "00", Message: "Confirm Success" }
        : { RspCode: "04", Message: "Invalid amount" };
    }
    if (payment.amountVnd !== amountVnd) {
      await auditReconciliation({
        result: "AMOUNT_MISMATCH",
        expectedAmountVnd: payment.amountVnd,
        providerAmountVnd: amountVnd,
      });
      return { RspCode: "04", Message: "Invalid amount" };
    }

    const successful =
      params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
    const now = new Date();
    if (!successful) {
      if (eventKind === "RECONCILIATION") {
        await auditReconciliation({
          result: "NOT_PAID",
          orderStatus: order.orderStatus,
          paymentStatus: payment.status,
          responseCode: params.vnp_ResponseCode ?? null,
          transactionStatus: params.vnp_TransactionStatus ?? null,
        });
        return { RspCode: "00", Message: "Confirm Success" };
      }
      if (payment.status === "PENDING") {
        await releaseInventoryReservation(tx, {
          orderId: order.id,
          note: "VNPAY reported an unsuccessful transaction",
        });
        await tx
          .update(payments)
          .set({ status: "FAILED", updatedAt: now })
          .where(eq(payments.id, payment.id));
        await tx
          .update(orders)
          .set({
            orderStatus: "CANCELLED",
            paymentStatus: "FAILED",
            cancelledAt: now,
            updatedAt: now,
          })
          .where(eq(orders.id, order.id));
      }
      return { RspCode: "00", Message: "Confirm Success" };
    }

    if (payment.status === "PAID") {
      await auditReconciliation({
        result: "ALREADY_PAID",
        orderStatus: order.orderStatus,
        paymentStatus: payment.status,
        providerTransactionId: payment.providerTransactionId,
      });
      return { RspCode: "00", Message: "Confirm Success" };
    }
    const hasReservation = await hasActiveInventoryReservation(tx, order.id);
    if (!hasReservation) {
      await tx
        .update(payments)
        .set({
          status: "MANUAL_REVIEW",
          providerTransactionId: params.vnp_TransactionNo ?? null,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));
      await tx
        .update(orders)
        .set({ paymentStatus: "MANUAL_REVIEW", updatedAt: now })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        dimension: "PAYMENT",
        fromStatus: order.paymentStatus,
        toStatus: "MANUAL_REVIEW",
        reason: "Verified payment arrived after inventory reservation release",
      });
      await auditReconciliation({
        result: "MANUAL_REVIEW",
        orderStatus: order.orderStatus,
        paymentStatus: "MANUAL_REVIEW",
        providerTransactionId: params.vnp_TransactionNo ?? null,
      });
      return { RspCode: "00", Message: "Confirm Success" };
    }

    await commitInventoryReservation(tx, {
      orderId: order.id,
      note: "VNPAY payment confirmed",
    });
    await tx
      .update(payments)
      .set({
        status: "PAID",
        providerTransactionId: params.vnp_TransactionNo ?? null,
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));
    await tx
      .update(orders)
      .set({
        orderStatus: "CONFIRMED",
        paymentStatus: "PAID",
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values([
      {
        orderId: order.id,
        dimension: "PAYMENT",
        fromStatus: order.paymentStatus,
        toStatus: "PAID",
        reason: `${eventKind} verified by VNPAY signature`,
      },
      ...(order.orderStatus === "PENDING_PAYMENT"
        ? [
            {
              orderId: order.id,
              dimension: "ORDER",
              fromStatus: order.orderStatus,
              toStatus: "CONFIRMED",
              reason: "Payment confirmed",
            },
          ]
        : []),
    ]);

    const [address] = await tx
      .select({ email: orderAddresses.email })
      .from(orderAddresses)
      .where(eq(orderAddresses.orderId, order.id))
      .limit(1);
    if (address?.email) {
      await enqueueEmail(tx, {
        orderId: order.id,
        deduplicationKey: `payment-paid:${payment.id}`,
        template: "payment-paid",
        recipient: address.email,
        payload: { orderNumber: order.orderNumber, amountVnd },
      });
    }
    await auditReconciliation({
      result: "PAID",
      orderStatus: "CONFIRMED",
      paymentStatus: "PAID",
      providerTransactionId: params.vnp_TransactionNo ?? null,
    });
    return { RspCode: "00", Message: "Confirm Success" };
  });
}

async function applyVerifiedVnpayResult(
  rawInput: URLSearchParams | VnpayParameters,
  config: Pick<VnpayConfig, "hashSecret" | "tmnCode">,
): Promise<VnpayIpnResponse> {
  const params = stringParameters(rawInput);

  // This gate intentionally runs before getDb(): an invalid checksum can never
  // cause a lookup, lock, event insert, or state mutation.
  if (!verifyVnpaySignature(params, config.hashSecret)) {
    return { RspCode: "97", Message: "Invalid Checksum" };
  }
  if (params.vnp_TmnCode !== config.tmnCode) {
    return { RspCode: "97", Message: "Invalid merchant" };
  }
  return applyTrustedVnpayResult(params, "IPN");
}

export function processVnpayIpn(
  input: URLSearchParams | VnpayParameters,
  config: Pick<VnpayConfig, "hashSecret" | "tmnCode"> = getVnpayConfig(),
) {
  return applyVerifiedVnpayResult(input, config);
}

export class PaymentReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentReconciliationError";
  }
}

export async function reconcilePaymentByQuery(input: {
  paymentId: string;
  actorId: string;
  ipAddress: string;
  config?: VnpayConfig;
  fetchImplementation?: typeof fetch;
}): Promise<VnpayIpnResponse> {
  const config = input.config ?? getVnpayConfig();
  const [candidate] = await getDb()
    .select({
      paymentId: payments.id,
      provider: payments.provider,
      providerReference: payments.providerReference,
      providerTransactionId: payments.providerTransactionId,
      orderNumber: orders.orderNumber,
      transactionDate: orders.createdAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(payments.id, input.paymentId))
    .limit(1);
  if (!candidate) throw new PaymentReconciliationError("Payment was not found.");
  if (candidate.provider !== "VNPAY" || !candidate.providerReference) {
    throw new PaymentReconciliationError("Only VNPAY payments can use QueryDr.");
  }

  const providerResult = await queryVnpayTransaction({
    requestId: randomBytes(16).toString("hex"),
    transactionReference: candidate.providerReference,
    transactionDate: candidate.transactionDate,
    providerTransactionId: candidate.providerTransactionId,
    createdAt: new Date(),
    ipAddress: input.ipAddress,
    orderInfo: `Query transaction ${candidate.orderNumber}`,
    config,
    fetchImplementation: input.fetchImplementation,
  });
  const result = await applyTrustedVnpayResult(
    {
      vnp_TmnCode: providerResult.vnp_TmnCode,
      vnp_TxnRef: providerResult.vnp_TxnRef,
      vnp_Amount: providerResult.vnp_Amount,
      vnp_ResponseCode: providerResult.vnp_ResponseCode,
      vnp_TransactionStatus: providerResult.vnp_TransactionStatus,
      vnp_TransactionNo: providerResult.vnp_TransactionNo,
      vnp_BankCode: providerResult.vnp_BankCode,
      vnp_PayDate: providerResult.vnp_PayDate,
    },
    "RECONCILIATION",
    input.actorId,
  );
  if (result.RspCode !== "00") {
    throw new PaymentReconciliationError(result.Message);
  }
  return result;
}

export async function listAdminPayments(input: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
} = {}) {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const conditions: SQL[] = [];
  if (input.q?.trim()) {
    const pattern = `%${input.q.trim()}%`;
    conditions.push(or(
      ilike(orders.orderNumber, pattern),
      ilike(payments.providerReference, pattern),
      ilike(payments.providerTransactionId, pattern),
    )!);
  }
  if (input.status) conditions.push(sql`${payments.status}::text = ${input.status}`);
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      provider: payments.provider,
      providerReference: payments.providerReference,
      providerTransactionId: payments.providerTransactionId,
      amountVnd: payments.amountVnd,
      status: payments.status,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(where)
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(limit)
    .offset(offset),
    db
      .select({ count: count() })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}
