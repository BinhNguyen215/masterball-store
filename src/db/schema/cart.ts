import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  text,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { productVariants } from "./catalog";

export const cartStatusEnum = pgEnum("cart_status", [
  "ACTIVE",
  "CONVERTED",
  "EXPIRED",
]);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: cartStatusEnum("status").default("ACTIVE").notNull(),
    version: integer("version").default(1).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("carts_token_hash_unique").on(table.tokenHash),
    check("carts_version_check", sql`${table.version} > 0`),
    index("carts_user_status_idx").on(table.userId, table.status),
    index("carts_expiry_idx").on(table.status, table.expiresAt),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    priceAtAddVnd: integer("price_at_add_vnd").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("cart_items_cart_variant_unique").on(table.cartId, table.variantId),
    check("cart_items_quantity_check", sql`${table.quantity} > 0`),
    check("cart_items_price_check", sql`${table.priceAtAddVnd} >= 0`),
    index("cart_items_cart_id_idx").on(table.cartId),
    index("cart_items_variant_id_idx").on(table.variantId),
  ],
);
