import { randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import {
  fulfillmentStatusEnum,
  orderAddresses,
  orderItems,
  orders,
  orderStatusEnum,
  orderStatusHistory,
  payments,
  paymentStatusEnum,
  rateLimits,
} from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";
import {
  commitInventoryReservation,
  releaseInventoryReservation,
} from "@/modules/inventory";

import { hashOrderLookupToken } from "./order-token";
import {
  canTransition,
  fulfillmentTransitions,
  orderTransitions,
  paymentTransitions,
} from "./order-state";

export class OrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStateError";
  }
}

export async function getOrderByLookupToken(token: string) {
  const lookupTokenHash = hashOrderLookupToken(token);
  const [order] = await getDb()
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.lookupTokenHash, lookupTokenHash))
    .limit(1);
  if (!order) return null;
  return loadOrderBundle(order.id);
}

const orderIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const orderNumberPattern = /^MB-[0-9A-F]{20}$/;

export async function getOrderById(orderId: string) {
  if (!orderIdPattern.test(orderId)) return null;
  return loadOrderBundle(orderId);
}

/**
 * National-format Vietnamese phone digits, so `+84 901 234 567`, `0901 234 567`
 * and `84901234567` all compare equal.
 */
export function normalizeOrderLookupPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  return digits.startsWith("84") && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}

/**
 * Resolves an order from evidence the customer holds: the order number printed
 * on the confirmation email plus the phone number used at checkout.
 */
export async function findOrderIdByContact(input: {
  orderNumber: string;
  phone: string;
}): Promise<string | null> {
  const orderNumber = input.orderNumber.trim().toUpperCase();
  const phone = normalizeOrderLookupPhone(input.phone);
  if (!orderNumberPattern.test(orderNumber)) return null;
  if (phone.length < 9 || phone.length > 11) return null;

  const storedPhone = sql`regexp_replace(${orderAddresses.phone}, '[^0-9]', '', 'g')`;
  const [row] = await getDb()
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderAddresses, eq(orderAddresses.orderId, orders.id))
    .where(
      and(
        eq(orders.orderNumber, orderNumber),
        or(eq(storedPhone, phone), eq(storedPhone, `84${phone.slice(1)}`)),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

const ORDER_LOOKUP_WINDOW_MS = 10 * 60_000;
const ORDER_LOOKUP_MAX_ATTEMPTS = 8;

/**
 * Fixed-window budgets for the guest endpoints one client can drive. The
 * mutation scopes are deliberately generous because they only exist to stop a
 * single client from flooding order creation, never to slow a real shopper
 * down mid-purchase.
 */
const GUEST_RATE_LIMITS = {
  "cart-mutation": { maxAttempts: 30, windowMs: 5 * 60_000 },
  "checkout-submit": { maxAttempts: 30, windowMs: 5 * 60_000 },
  "order-lookup": {
    maxAttempts: ORDER_LOOKUP_MAX_ATTEMPTS,
    windowMs: ORDER_LOOKUP_WINDOW_MS,
  },
  // A shop counter or a playgroup registers several people from one device, so
  // this bucket is deliberately more generous than the lookup one.
  "tournament-registration": { maxAttempts: 40, windowMs: 10 * 60_000 },
  "product-review": { maxAttempts: 10, windowMs: 10 * 60_000 },
  "restock-alert": { maxAttempts: 20, windowMs: 10 * 60_000 },
  // Shopper sign-in/registration. Deliberately tight: these endpoints mint
  // sessions, so credential stuffing is the threat, not a real shopper.
  "customer-auth": { maxAttempts: 10, windowMs: 10 * 60_000 },
} as const;

export type GuestRateLimitScope = keyof typeof GUEST_RATE_LIMITS;

/**
 * Fixed-window throttle for guest endpoints, stored in the shared `rateLimit`
 * table so it holds across instances. Each scope owns its own bucket key so
 * throttling one endpoint never spends another one's budget. Returns false when
 * the caller must be rejected; a rejected attempt still records its timestamp.
 */
export async function consumeGuestRateLimit(input: {
  scope: GuestRateLimitScope;
  clientKey: string;
  now?: Date;
}): Promise<boolean> {
  const { maxAttempts, windowMs } = GUEST_RATE_LIMITS[input.scope];
  const key = `${input.scope}:${input.clientKey}`;
  const timestamp = (input.now ?? new Date()).getTime();
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1)
      .for("update");

    if (!row || timestamp - row.lastRequest > windowMs) {
      if (row) {
        await tx
          .update(rateLimits)
          .set({ count: 1, lastRequest: timestamp })
          .where(eq(rateLimits.key, key));
      } else {
        await tx
          .insert(rateLimits)
          .values({ id: randomUUID(), key, count: 1, lastRequest: timestamp })
          .onConflictDoNothing();
      }
      return true;
    }

    const count = row.count + 1;
    await tx
      .update(rateLimits)
      .set({ count, lastRequest: timestamp })
      .where(eq(rateLimits.key, key));
    return count <= maxAttempts;
  });
}

/**
 * Fixed-window throttle for guest lookup attempts. Kept as its own entry point
 * because the lookup form was the first caller and the documented contract is
 * "reject the ninth attempt in a ten-minute window from one client".
 */
export async function consumeOrderLookupAttempt(
  clientKey: string,
  now: Date = new Date(),
): Promise<boolean> {
  return consumeGuestRateLimit({ clientKey, now, scope: "order-lookup" });
}

/**
 * Recent status history for one order, oldest first. The customer-facing
 * tracking page reads this instead of the audit trail, so the actor and the
 * internal reason stay behind the admin boundary.
 */
export async function listOrderStatusHistory(orderId: string, limit = 20) {
  const rows = await getDb()
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(desc(orderStatusHistory.createdAt), desc(orderStatusHistory.id))
    .limit(limit);
  return rows.reverse();
}

async function loadOrderBundle(orderId: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;
  const [address, items] = await Promise.all([
    db
      .select()
      .from(orderAddresses)
      .where(eq(orderAddresses.orderId, order.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.id)),
  ]);
  return { ...order, address, items };
}

export async function transitionOrder(input: {
  orderId: string;
  dimension: "ORDER" | "FULFILLMENT";
  toStatus: string;
  actorId?: string | null;
  reason?: string | null;
  trackingNumber?: string | null;
  internalNote?: string | null;
  expectedVersion?: number;
}) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    if (!order) throw new OrderStateError("Order was not found.");
    if (input.expectedVersion !== undefined && order.version !== input.expectedVersion) {
      throw new OrderStateError("Order was changed by another request.");
    }
    const now = new Date();

    if (input.dimension === "ORDER") {
      if (!canTransition(orderTransitions, order.orderStatus, input.toStatus)) {
        throw new OrderStateError(
          `Order cannot transition from ${order.orderStatus} to ${input.toStatus}.`,
        );
      }
      const target = input.toStatus as typeof order.orderStatus;
      if (target === "CANCELLED" && order.paymentStatus === "PAID") {
        throw new OrderStateError("A paid order must be refunded or moved to manual review before cancellation.");
      }
      if (target === "CANCELLED") {
        await releaseInventoryReservation(tx, {
          orderId: order.id,
          actorId: input.actorId,
          note: input.reason,
        });
        await tx
          .update(payments)
          .set({
            status: "FAILED",
            updatedAt: now,
          })
          .where(and(eq(payments.orderId, order.id), eq(payments.status, "PENDING")));
      }
      await tx
        .update(orders)
        .set({
          orderStatus: target,
          paymentStatus:
            target === "CANCELLED" && order.paymentStatus === "PENDING"
              ? "FAILED"
              : order.paymentStatus,
          cancelledAt: target === "CANCELLED" ? now : order.cancelledAt,
          completedAt: target === "COMPLETED" ? now : order.completedAt,
          internalNote: input.internalNote ?? order.internalNote,
          version: sql`${orders.version} + 1`,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        actorId: input.actorId ?? null,
        dimension: "ORDER",
        fromStatus: order.orderStatus,
        toStatus: target,
        reason: input.reason ?? null,
      });
      await appendAuditLog(tx, {
        actorId: input.actorId ?? null,
        action: "order.transition",
        subjectType: "order",
        subjectId: order.id,
        before: { orderStatus: order.orderStatus, version: order.version },
        after: { orderStatus: target, version: order.version + 1 },
      });
      return { ...order, orderStatus: target, version: order.version + 1 };
    }

    if (!canTransition(fulfillmentTransitions, order.fulfillmentStatus, input.toStatus)) {
      throw new OrderStateError(
        `Fulfillment cannot transition from ${order.fulfillmentStatus} to ${input.toStatus}.`,
      );
    }
    const target = input.toStatus as typeof order.fulfillmentStatus;
    if (target === "SHIPPED" && !input.trackingNumber?.trim()) {
      throw new OrderStateError("A tracking number is required when an order is shipped.");
    }
    if (target === "SHIPPED" && order.paymentMethod === "COD") {
      await commitInventoryReservation(tx, {
        orderId: order.id,
        actorId: input.actorId,
        note: "COD order shipped",
      });
    }
    await tx
      .update(orders)
      .set({
        fulfillmentStatus: target,
        trackingNumber: input.trackingNumber?.trim() || order.trackingNumber,
        internalNote: input.internalNote ?? order.internalNote,
        version: sql`${orders.version} + 1`,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      actorId: input.actorId ?? null,
      dimension: "FULFILLMENT",
      fromStatus: order.fulfillmentStatus,
      toStatus: target,
      reason: input.reason ?? null,
    });
    await appendAuditLog(tx, {
      actorId: input.actorId ?? null,
      action: "order.fulfillment.transition",
      subjectType: "order",
      subjectId: order.id,
      before: {
        fulfillmentStatus: order.fulfillmentStatus,
        trackingNumber: order.trackingNumber,
        version: order.version,
      },
      after: {
        fulfillmentStatus: target,
        trackingNumber: input.trackingNumber?.trim() || order.trackingNumber,
        version: order.version + 1,
      },
    });
    return {
      ...order,
      fulfillmentStatus: target,
      trackingNumber: input.trackingNumber?.trim() || order.trackingNumber,
      version: order.version + 1,
    };
  });
}

export function cancelOrder(input: {
  orderId: string;
  actorId?: string | null;
  reason?: string | null;
  expectedVersion?: number;
}) {
  return transitionOrder({ ...input, dimension: "ORDER", toStatus: "CANCELLED" });
}

export type ManualSettlementInput = {
  orderId: string;
  expectedVersion: number;
  actorId: string;
  note: string;
};

export type ManualSettlementMethod = "COD" | "BANK_TRANSFER";

const SETTLEMENT_SCOPE_MESSAGE: Record<ManualSettlementMethod, string> = {
  COD: "Only cash-on-delivery orders are settled here.",
  BANK_TRANSFER: "Only bank-transfer orders are settled here.",
};

/**
 * Records money an operator confirmed by hand — cash on delivery, or a bank
 * transfer credited to the shop account. No payment provider can confirm
 * either, so the operator who took the money is the source of truth; the change
 * still runs through the payment state machine and writes an order history row
 * plus an audit entry in the same transaction.
 *
 * A bank transfer was created like an online payment (reserved stock with an
 * expiry), so confirming it also confirms the order and commits the
 * reservation; a COD order keeps its stock reservation until it ships.
 */
async function settleManualPayment(
  input: ManualSettlementInput,
  method: ManualSettlementMethod,
) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    if (!order) throw new OrderStateError("Order was not found.");
    if (order.version !== input.expectedVersion) {
      throw new OrderStateError("Order was changed by another request.");
    }
    if (order.paymentMethod !== method) {
      throw new OrderStateError(SETTLEMENT_SCOPE_MESSAGE[method]);
    }
    if (order.orderStatus === "CANCELLED") {
      throw new OrderStateError(
        order.paymentMethod === "BANK_TRANSFER"
          ? "A cancelled order cannot be settled."
          : "A cancelled order cannot collect cash.",
      );
    }
    if (!canTransition(paymentTransitions, order.paymentStatus, "PAID")) {
      throw new OrderStateError(
        `Payment cannot transition from ${order.paymentStatus} to PAID.`,
      );
    }
    // `canTransition` accepts a no-op transition, so settling twice would
    // record a second collection for money that is already in the till.
    if (order.paymentStatus === "PAID") {
      throw new OrderStateError("This order is already marked as paid.");
    }
    const now = new Date();
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.provider, "COD")))
      .limit(1)
      .for("update");
    if (!payment) {
      throw new OrderStateError(
        order.paymentMethod === "BANK_TRANSFER"
          ? "The bank-transfer payment record was not found."
          : "The cash payment record was not found.",
      );
    }

    const isBankTransfer = order.paymentMethod === "BANK_TRANSFER";
    if (isBankTransfer) {
      await commitInventoryReservation(tx, {
        orderId: order.id,
        actorId: input.actorId,
        note: "Bank transfer confirmed",
      });
    }
    // A bank transfer was created as an online payment, so confirming the
    // money confirms the order too. The order state machine stays the owner of
    // that move: a completed or cancelled order is left exactly as it is.
    const orderStatus =
      isBankTransfer && canTransition(orderTransitions, order.orderStatus, "CONFIRMED")
        ? "CONFIRMED"
        : order.orderStatus;

    await tx
      .update(payments)
      .set({ status: "PAID", paidAt: now, updatedAt: now })
      .where(eq(payments.id, payment.id));
    await tx
      .update(orders)
      .set({
        paymentStatus: "PAID",
        orderStatus,
        version: sql`${orders.version} + 1`,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values([
      {
        orderId: order.id,
        actorId: input.actorId,
        dimension: "PAYMENT",
        fromStatus: order.paymentStatus,
        toStatus: "PAID",
        reason: input.note,
      },
      ...(orderStatus === order.orderStatus
        ? []
        : [
            {
              orderId: order.id,
              actorId: input.actorId,
              dimension: "ORDER",
              fromStatus: order.orderStatus,
              toStatus: orderStatus,
              reason: input.note,
            },
          ]),
    ]);
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "order.payment.settle",
      subjectType: "order",
      subjectId: order.id,
      before: {
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        version: order.version,
      },
      after: {
        orderStatus,
        paymentStatus: "PAID",
        paymentMethod: order.paymentMethod,
        version: order.version + 1,
      },
    });
    return {
      ...order,
      orderStatus,
      paymentStatus: "PAID" as const,
      version: order.version + 1,
    };
  });
}

/** Cash collected at the door. */
export function settleCashPayment(input: ManualSettlementInput) {
  return settleManualPayment(input, "COD");
}

/** Money credited to the shop account and confirmed from the payments console. */
export function settleBankTransferPayment(input: ManualSettlementInput) {
  return settleManualPayment(input, "BANK_TRANSFER");
}

export async function expirePendingOrders(
  options: { now?: Date; batchSize?: number } = {},
) {
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, Math.min(200, options.batchSize ?? 50));
  return getDb().transaction(async (tx) => {
    const expired = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderStatus, "PENDING_PAYMENT"),
          eq(orders.paymentStatus, "PENDING"),
          lt(orders.reservationExpiresAt, now),
        ),
      )
      .orderBy(asc(orders.id))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    for (const order of expired) {
      await releaseInventoryReservation(tx, {
        orderId: order.id,
        note: "Online payment reservation expired",
      });
      await tx
        .update(orders)
        .set({
          orderStatus: "CANCELLED",
          paymentStatus: "FAILED",
          cancelledAt: now,
          version: sql`${orders.version} + 1`,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await tx
        .update(payments)
        .set({ status: "FAILED", updatedAt: now })
        .where(
          and(eq(payments.orderId, order.id), eq(payments.status, "PENDING")),
        );
      await tx.insert(orderStatusHistory).values([
        {
          orderId: order.id,
          dimension: "ORDER",
          fromStatus: order.orderStatus,
          toStatus: "CANCELLED",
          reason: "Payment reservation expired",
        },
        {
          orderId: order.id,
          dimension: "PAYMENT",
          fromStatus: order.paymentStatus,
          toStatus: "FAILED",
          reason: "Payment reservation expired",
        },
      ]);
    }
    return expired.map((order) => order.id);
  });
}

export async function listAdminOrders(input: {
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
      ilike(orderAddresses.recipientName, pattern),
      ilike(orderAddresses.phone, pattern),
    )!);
  }
  if (input.status) {
    // Compare against each enum column directly so the status indexes stay
    // usable; a value that belongs to none of the three enums matches nothing.
    const status = input.status;
    const perDimension: SQL[] = [];
    if ((orderStatusEnum.enumValues as readonly string[]).includes(status)) {
      perDimension.push(sql`${orders.orderStatus} = ${status}::order_status`);
    }
    if ((paymentStatusEnum.enumValues as readonly string[]).includes(status)) {
      perDimension.push(sql`${orders.paymentStatus} = ${status}::payment_status`);
    }
    if ((fulfillmentStatusEnum.enumValues as readonly string[]).includes(status)) {
      perDimension.push(
        sql`${orders.fulfillmentStatus} = ${status}::fulfillment_status`,
      );
    }
    conditions.push(perDimension.length ? or(...perDimension)! : sql`false`);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      orderStatus: orders.orderStatus,
      paymentStatus: orders.paymentStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentMethod: orders.paymentMethod,
      version: orders.version,
      totalVnd: orders.totalVnd,
      recipientName: orderAddresses.recipientName,
      phone: orderAddresses.phone,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(orderAddresses, eq(orderAddresses.orderId, orders.id))
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit)
    .offset(offset),
    db
      .select({ count: count() })
      .from(orders)
      .innerJoin(orderAddresses, eq(orderAddresses.orderId, orders.id))
      .where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}

/** One order the signed-in shopper owns, with the lines and timeline it needs. */
export type CustomerOrderRow = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  subtotalVnd: number;
  shippingVnd: number;
  discountVnd: number;
  totalVnd: number;
  trackingNumber: string | null;
  customerNote: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    productTitle: string;
    variantSku: string;
    unitPriceVnd: number;
    quantity: number;
    lineTotalVnd: number;
  }>;
  history: Array<{
    id: string;
    dimension: string;
    toStatus: string;
    createdAt: Date;
  }>;
};

/**
 * The orders belonging to one customer, newest first. Ownership is the query
 * itself — `orders.user_id = userId` — so a customer can never read another
 * shopper's history, and the guest lookup token is not involved at all.
 */
export async function listCustomerOrders(
  userId: string,
  input: { limit?: number; offset?: number } = {},
): Promise<{ items: CustomerOrderRow[]; total: number }> {
  const limit = Math.max(1, Math.min(50, input.limit ?? 20));
  const offset = Math.max(0, input.offset ?? 0);
  const db = getDb();
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        paymentMethod: orders.paymentMethod,
        subtotalVnd: orders.subtotalVnd,
        shippingVnd: orders.shippingVnd,
        discountVnd: orders.discountVnd,
        totalVnd: orders.totalVnd,
        trackingNumber: orders.trackingNumber,
        customerNote: orders.customerNote,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.userId, userId)),
  ]);

  const orderIds = rows.map((row) => row.id);
  const [lineRows, historyRows] = orderIds.length
    ? await Promise.all([
        db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productTitle: orderItems.productTitle,
            variantSku: orderItems.variantSku,
            unitPriceVnd: orderItems.unitPriceVnd,
            quantity: orderItems.quantity,
            lineTotalVnd: orderItems.lineTotalVnd,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .orderBy(asc(orderItems.id)),
        db
          .select({
            id: orderStatusHistory.id,
            orderId: orderStatusHistory.orderId,
            dimension: orderStatusHistory.dimension,
            toStatus: orderStatusHistory.toStatus,
            createdAt: orderStatusHistory.createdAt,
          })
          .from(orderStatusHistory)
          .where(inArray(orderStatusHistory.orderId, orderIds))
          .orderBy(asc(orderStatusHistory.createdAt), asc(orderStatusHistory.id)),
      ])
    : [[], []];

  const linesByOrder = new Map<string, CustomerOrderRow["items"]>();
  for (const { orderId, ...line } of lineRows) {
    const lines = linesByOrder.get(orderId);
    if (lines) lines.push(line);
    else linesByOrder.set(orderId, [line]);
  }
  const historyByOrder = new Map<string, CustomerOrderRow["history"]>();
  for (const { orderId, ...entry } of historyRows) {
    const entries = historyByOrder.get(orderId);
    if (entries) entries.push(entry);
    else historyByOrder.set(orderId, [entry]);
  }

  return {
    items: rows.map((row) => ({
      ...row,
      items: linesByOrder.get(row.id) ?? [],
      history: historyByOrder.get(row.id) ?? [],
    })),
    total: Number(totalRow?.count ?? 0),
  };
}
