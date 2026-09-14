import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { getDb, type AppTransaction } from "@/db";
import {
  inventories,
  inventoryMovements,
  inventoryReservations,
  productVariants,
  products,
} from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

import { InventoryError } from "./inventory-errors";

export type InventoryReservationItem = {
  variantId: string;
  quantity: number;
};

type MutationContext = {
  actorId?: string | null;
  note?: string | null;
};

export function normalizeInventoryReservationItems(items: InventoryReservationItem[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new InventoryError("Inventory quantity must be a positive integer.", "INVALID_QUANTITY");
    }
    quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  }
  return [...quantities.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
}

async function lockInventoryRows(tx: AppTransaction, variantIds: string[]) {
  const rows = await tx
    .select()
    .from(inventories)
    .where(inArray(inventories.variantId, variantIds))
    .orderBy(asc(inventories.variantId))
    .for("update");
  if (rows.length !== variantIds.length) {
    const found = new Set(rows.map((row) => row.variantId));
    const missing = variantIds.filter((id) => !found.has(id));
    throw new InventoryError(
      `Inventory does not exist for variant(s): ${missing.join(", ")}.`,
      "INVENTORY_NOT_FOUND",
    );
  }
  return new Map(rows.map((row) => [row.variantId, row]));
}

export async function adjustInventory(input: {
  variantId: string;
  onHandDelta: number;
  referenceType: string;
  referenceId: string;
} & MutationContext) {
  if (!Number.isInteger(input.onHandDelta) || input.onHandDelta === 0) {
    throw new InventoryError("Inventory adjustment must be a non-zero integer.", "INVALID_QUANTITY");
  }
  return getDb().transaction((tx) => adjustInventoryInTransaction(tx, input));
}

export async function adjustInventoryInTransaction(
  tx: AppTransaction,
  input: {
    variantId: string;
    onHandDelta: number;
    referenceType: string;
    referenceId: string;
  } & MutationContext,
) {
  if (!Number.isInteger(input.onHandDelta) || input.onHandDelta === 0) {
    throw new InventoryError("Inventory adjustment must be a non-zero integer.", "INVALID_QUANTITY");
  }
    const locked = await lockInventoryRows(tx, [input.variantId]);
    const current = locked.get(input.variantId)!;
    const onHandAfter = current.onHand + input.onHandDelta;
    if (onHandAfter < current.reserved) {
      throw new InventoryError(
        "Adjustment would make available inventory negative.",
        "INVALID_ADJUSTMENT",
      );
    }
    await tx
      .update(inventories)
      .set({
        onHand: onHandAfter,
        version: sql`${inventories.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(inventories.variantId, input.variantId));
    await tx.insert(inventoryMovements).values({
      variantId: input.variantId,
      type: input.onHandDelta > 0 ? "RECEIVE" : "ADJUST",
      onHandDelta: input.onHandDelta,
      reservedDelta: 0,
      onHandAfter,
      reservedAfter: current.reserved,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
    });
  await appendAuditLog(tx, {
    actorId: input.actorId ?? null,
    action: "inventory.adjust",
    subjectType: "inventory",
    subjectId: input.variantId,
    before: {
      onHand: current.onHand,
      reserved: current.reserved,
      version: current.version,
    },
    after: {
      onHand: onHandAfter,
      reserved: current.reserved,
      version: current.version + 1,
    },
  });
  return { variantId: input.variantId, onHand: onHandAfter, reserved: current.reserved };
}

export async function receiveInventory(
  input: Omit<Parameters<typeof adjustInventory>[0], "onHandDelta"> & { quantity: number },
) {
  return adjustInventory({ ...input, onHandDelta: input.quantity });
}

export async function reserveInventory(
  tx: AppTransaction,
  input: {
    orderId: string;
    items: InventoryReservationItem[];
    expiresAt: Date | null;
  } & MutationContext,
): Promise<void> {
  const items = normalizeInventoryReservationItems(input.items);
  const locked = await lockInventoryRows(
    tx,
    items.map((item) => item.variantId),
  );

  for (const item of items) {
    const current = locked.get(item.variantId)!;
    if (current.onHand - current.reserved < item.quantity) {
      throw new InventoryError(
        `Insufficient inventory for variant ${item.variantId}.`,
        "INSUFFICIENT_STOCK",
      );
    }
  }

  await tx.insert(inventoryReservations).values(
    items.map((item) => ({
      orderId: input.orderId,
      variantId: item.variantId,
      quantity: item.quantity,
      expiresAt: input.expiresAt,
    })),
  );

  for (const item of items) {
    const current = locked.get(item.variantId)!;
    const reservedAfter = current.reserved + item.quantity;
    await tx
      .update(inventories)
      .set({
        reserved: reservedAfter,
        version: sql`${inventories.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(inventories.variantId, item.variantId));
    await tx.insert(inventoryMovements).values({
      variantId: item.variantId,
      type: "RESERVE",
      onHandDelta: 0,
      reservedDelta: item.quantity,
      onHandAfter: current.onHand,
      reservedAfter,
      referenceType: "ORDER",
      referenceId: input.orderId,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
    });
  }
}

async function finalizeReservation(
  tx: AppTransaction,
  input: { orderId: string; action: "RELEASE" | "COMMIT" } & MutationContext,
) {
  const reservations = await tx
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.orderId, input.orderId),
        eq(inventoryReservations.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(inventoryReservations.variantId))
    .for("update");
  if (!reservations.length) return false;

  const locked = await lockInventoryRows(
    tx,
    reservations.map((reservation) => reservation.variantId),
  );
  const now = new Date();

  for (const reservation of reservations) {
    const current = locked.get(reservation.variantId)!;
    const reservedAfter = current.reserved - reservation.quantity;
    const onHandAfter =
      input.action === "COMMIT"
        ? current.onHand - reservation.quantity
        : current.onHand;
    if (reservedAfter < 0 || onHandAfter < reservedAfter) {
      throw new InventoryError(
        `Inventory ledger is inconsistent for variant ${reservation.variantId}.`,
        "INVALID_ADJUSTMENT",
      );
    }
    await tx
      .update(inventories)
      .set({
        onHand: onHandAfter,
        reserved: reservedAfter,
        version: sql`${inventories.version} + 1`,
        updatedAt: now,
      })
      .where(eq(inventories.variantId, reservation.variantId));
    await tx
      .update(inventoryReservations)
      .set(
        input.action === "COMMIT"
          ? { status: "COMMITTED", committedAt: now }
          : { status: "RELEASED", releasedAt: now },
      )
      .where(eq(inventoryReservations.id, reservation.id));
    await tx.insert(inventoryMovements).values({
      variantId: reservation.variantId,
      type: input.action === "COMMIT" ? "COMMIT_SALE" : "RELEASE",
      onHandDelta: input.action === "COMMIT" ? -reservation.quantity : 0,
      reservedDelta: -reservation.quantity,
      onHandAfter,
      reservedAfter,
      referenceType: "ORDER",
      referenceId: input.orderId,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
    });
  }
  return true;
}

export function releaseInventoryReservation(
  tx: AppTransaction,
  input: { orderId: string } & MutationContext,
) {
  return finalizeReservation(tx, { ...input, action: "RELEASE" });
}

export function commitInventoryReservation(
  tx: AppTransaction,
  input: { orderId: string } & MutationContext,
) {
  return finalizeReservation(tx, { ...input, action: "COMMIT" });
}

export async function hasActiveInventoryReservation(
  tx: AppTransaction,
  orderId: string,
) {
  const [row] = await tx
    .select({ id: inventoryReservations.id })
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listAdminInventory(input: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: "LOW" | "OUT" | "AVAILABLE";
} = {}) {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const available = sql<number>`${inventories.onHand} - ${inventories.reserved}`;
  const conditions: SQL[] = [];
  if (input.q?.trim()) {
    const pattern = `%${input.q.trim()}%`;
    conditions.push(or(ilike(productVariants.sku, pattern), ilike(products.title, pattern))!);
  }
  if (input.status === "LOW") {
    conditions.push(sql`${available} > 0 and ${available} <= ${inventories.reorderPoint}`);
  } else if (input.status === "OUT") {
    conditions.push(sql`${available} = 0`);
  } else if (input.status === "AVAILABLE") {
    conditions.push(sql`${available} > 0`);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
    .select({
      variantId: inventories.variantId,
      sku: productVariants.sku,
      productTitle: products.title,
      onHand: inventories.onHand,
      reserved: inventories.reserved,
      available,
      reorderPoint: inventories.reorderPoint,
      version: inventories.version,
      updatedAt: inventories.updatedAt,
    })
    .from(inventories)
    .innerJoin(productVariants, eq(productVariants.id, inventories.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(where)
    .orderBy(desc(inventories.updatedAt), asc(productVariants.sku))
    .limit(limit)
    .offset(offset),
    db
      .select({ count: count() })
      .from(inventories)
      .innerJoin(productVariants, eq(productVariants.id, inventories.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}
