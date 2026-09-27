import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { productVariants } from "./catalog";
import { orders } from "./orders";

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "RECEIVE",
  "ADJUST",
  "RESERVE",
  "RELEASE",
  "COMMIT_SALE",
  "RETURN",
]);

export const inventoryReservationStatusEnum = pgEnum(
  "inventory_reservation_status",
  ["ACTIVE", "RELEASED", "COMMITTED"],
);

export const inventories = pgTable(
  "inventories",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    onHand: integer("on_hand").default(0).notNull(),
    reserved: integer("reserved").default(0).notNull(),
    reorderPoint: integer("reorder_point").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("inventories_on_hand_check", sql`${table.onHand} >= 0`),
    check("inventories_reserved_check", sql`${table.reserved} >= 0`),
    check(
      "inventories_available_check",
      sql`${table.onHand} - ${table.reserved} >= 0`,
    ),
    check("inventories_reorder_point_check", sql`${table.reorderPoint} >= 0`),
    check("inventories_version_check", sql`${table.version} > 0`),
    index("inventories_availability_idx").on(table.onHand, table.reserved),
    index("inventories_available_expr_idx").on(
      sql`(${table.onHand} - ${table.reserved})`,
    ),
    index("inventories_updated_idx").on(table.updatedAt, table.variantId),
  ],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    status: inventoryReservationStatusEnum("status").default("ACTIVE").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "date" }),
    committedAt: timestamp("committed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("inventory_reservations_order_variant_unique").on(
      table.orderId,
      table.variantId,
    ),
    check("inventory_reservations_quantity_check", sql`${table.quantity} > 0`),
    check(
      "inventory_reservations_released_check",
      sql`${table.status} <> 'RELEASED' or ${table.releasedAt} is not null`,
    ),
    check(
      "inventory_reservations_committed_check",
      sql`${table.status} <> 'COMMITTED' or ${table.committedAt} is not null`,
    ),
    index("inventory_reservations_order_status_idx").on(
      table.orderId,
      table.status,
    ),
    index("inventory_reservations_expiry_idx").on(table.status, table.expiresAt),
    index("inventory_reservations_variant_status_idx").on(
      table.variantId,
      table.status,
    ),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    type: inventoryMovementTypeEnum("type").notNull(),
    onHandDelta: integer("on_hand_delta").default(0).notNull(),
    reservedDelta: integer("reserved_delta").default(0).notNull(),
    onHandAfter: integer("on_hand_after").notNull(),
    reservedAfter: integer("reserved_after").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "inventory_movements_delta_check",
      sql`${table.onHandDelta} <> 0 or ${table.reservedDelta} <> 0`,
    ),
    check("inventory_movements_on_hand_check", sql`${table.onHandAfter} >= 0`),
    check("inventory_movements_reserved_check", sql`${table.reservedAfter} >= 0`),
    check(
      "inventory_movements_available_check",
      sql`${table.onHandAfter} - ${table.reservedAfter} >= 0`,
    ),
    index("inventory_movements_variant_created_idx").on(
      table.variantId,
      table.createdAt,
    ),
    index("inventory_movements_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
  ],
);

export const restockAlertStatusEnum = pgEnum("restock_alert_status", [
  "PENDING",
  "NOTIFIED",
  "CANCELLED",
]);

/**
 * "Tell me when this variant is back" requests. One row per address per variant;
 * the notification job flips the row to NOTIFIED instead of deleting it, so a
 * customer is never emailed twice for the same restock.
 */
export const restockAlerts = pgTable(
  "restock_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    status: restockAlertStatusEnum("status").default("PENDING").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("restock_alerts_variant_email_unique").on(table.variantId, table.email),
    check(
      "restock_alerts_email_check",
      sql`${table.email} = lower(${table.email}) and ${table.email} ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'`,
    ),
    check(
      "restock_alerts_notified_check",
      sql`${table.status} <> 'NOTIFIED' or ${table.notifiedAt} is not null`,
    ),
    index("restock_alerts_status_created_idx").on(table.status, table.createdAt),
  ],
);
