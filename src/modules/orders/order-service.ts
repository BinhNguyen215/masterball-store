import { and, asc, count, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import {
  orderAddresses,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
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
    .select()
    .from(orders)
    .where(eq(orders.lookupTokenHash, lookupTokenHash))
    .limit(1);
  if (!order) return null;
  const [address, items] = await Promise.all([
    getDb()
      .select()
      .from(orderAddresses)
      .where(eq(orderAddresses.orderId, order.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getDb()
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
      }
      await tx
        .update(orders)
        .set({
          orderStatus: target,
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
    if (target === "SHIPPED" && order.paymentMethod === "COD") {
      await commitInventoryReservation(tx, {
        orderId: order.id,
        actorId: input.actorId,
        note: "COD order shipped",
      });
    }
    if (target === "SHIPPED" && !input.trackingNumber?.trim()) {
      throw new OrderStateError("A tracking number is required when an order is shipped.");
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

export async function updateOrderDetails(input: {
  orderId: string;
  expectedVersion: number;
  actorId: string;
  trackingNumber?: string | null;
  internalNote?: string | null;
}) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    if (!before) throw new OrderStateError("Order was not found.");
    if (before.version !== input.expectedVersion) {
      throw new OrderStateError("Order was changed by another request.");
    }
    const [updated] = await tx
      .update(orders)
      .set({
        trackingNumber:
          input.trackingNumber === undefined
            ? before.trackingNumber
            : input.trackingNumber?.trim() || null,
        internalNote:
          input.internalNote === undefined ? before.internalNote : input.internalNote,
        version: sql`${orders.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, before.id), eq(orders.version, input.expectedVersion)))
      .returning();
    await tx.insert(orderStatusHistory).values({
      orderId: before.id,
      actorId: input.actorId,
      dimension: "DETAILS",
      fromStatus: null,
      toStatus: "UPDATED",
      reason: "Tracking or internal note updated",
    });
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "order.details.update",
      subjectType: "order",
      subjectId: before.id,
      before: {
        trackingNumber: before.trackingNumber,
        internalNote: before.internalNote,
        version: before.version,
      },
      after: {
        trackingNumber: updated.trackingNumber,
        internalNote: updated.internalNote,
        version: updated.version,
      },
    });
    return updated;
  });
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
    conditions.push(sql`(${orders.orderStatus}::text = ${input.status} or ${orders.paymentStatus}::text = ${input.status} or ${orders.fulfillmentStatus}::text = ${input.status})`);
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
