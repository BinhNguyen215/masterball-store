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

import { orders } from "./orders";

export const couponKindEnum = pgEnum("coupon_kind", ["PERCENT", "FIXED"]);

export const couponStatusEnum = pgEnum("coupon_status", ["ACTIVE", "DISABLED"]);

/**
 * Discount codes. The database owns the arithmetic invariants (value ranges,
 * usage ceiling, window order) so a checkout bug cannot mint an impossible
 * discount; `used_count` is the denormalised counter, reconciled by the unique
 * redemption row per order.
 */
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    kind: couponKindEnum("kind").notNull(),
    value: integer("value").notNull(),
    minOrderVnd: integer("min_order_vnd").default(0).notNull(),
    maxDiscountVnd: integer("max_discount_vnd"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").default(0).notNull(),
    status: couponStatusEnum("status").default("ACTIVE").notNull(),
    note: text("note"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("coupons_code_check", sql`${table.code} = upper(${table.code})`),
    check(
      "coupons_code_format_check",
      sql`${table.code} ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'`,
    ),
    check("coupons_value_check", sql`${table.value} > 0`),
    check(
      "coupons_percent_check",
      sql`${table.kind} <> 'PERCENT' or ${table.value} <= 100`,
    ),
    check("coupons_min_order_check", sql`${table.minOrderVnd} >= 0`),
    check(
      "coupons_max_discount_check",
      sql`${table.maxDiscountVnd} is null or ${table.maxDiscountVnd} > 0`,
    ),
    check(
      "coupons_usage_limit_check",
      sql`${table.usageLimit} is null or ${table.usageLimit} > 0`,
    ),
    check(
      "coupons_used_count_check",
      sql`${table.usedCount} >= 0 and (${table.usageLimit} is null or ${table.usedCount} <= ${table.usageLimit})`,
    ),
    check(
      "coupons_window_check",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    check("coupons_version_check", sql`${table.version} > 0`),
    index("coupons_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    amountVnd: integer("amount_vnd").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("coupon_redemptions_order_unique").on(table.orderId),
    check("coupon_redemptions_amount_check", sql`${table.amountVnd} > 0`),
    index("coupon_redemptions_coupon_created_idx").on(
      table.couponId,
      table.createdAt,
    ),
  ],
);
