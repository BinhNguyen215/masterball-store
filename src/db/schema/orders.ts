import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { carts } from "./cart";
import { productVariants } from "./catalog";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "MANUAL_REVIEW",
]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "UNFULFILLED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "COD",
  "VNPAY",
  "BANK_TRANSFER",
]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull(),
    lookupTokenHash: text("lookup_token_hash").notNull(),
    checkoutIdempotencyKey: text("checkout_idempotency_key").notNull(),
    cartId: uuid("cart_id").references(() => carts.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    orderStatus: orderStatusEnum("order_status").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull(),
    fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status")
      .default("UNFULFILLED")
      .notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    currency: text("currency").default("VND").notNull(),
    subtotalVnd: integer("subtotal_vnd").notNull(),
    shippingVnd: integer("shipping_vnd").notNull(),
    discountVnd: integer("discount_vnd").default(0).notNull(),
    totalVnd: integer("total_vnd").notNull(),
    // Deliberately not a foreign key: `coupons` imports this module, and a
    // coupon is disabled rather than deleted, so the reference stays valid.
    couponId: uuid("coupon_id"),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),
    trackingNumber: text("tracking_number"),
    version: integer("version").default(1).notNull(),
    reservationExpiresAt: timestamp("reservation_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("orders_order_number_unique").on(table.orderNumber),
    unique("orders_lookup_token_hash_unique").on(table.lookupTokenHash),
    unique("orders_checkout_idempotency_key_unique").on(
      table.checkoutIdempotencyKey,
    ),
    check("orders_currency_check", sql`${table.currency} = 'VND'`),
    check("orders_subtotal_check", sql`${table.subtotalVnd} >= 0`),
    check("orders_shipping_check", sql`${table.shippingVnd} >= 0`),
    check("orders_version_check", sql`${table.version} > 0`),
    check("orders_discount_check", sql`${table.discountVnd} >= 0`),
    check(
      "orders_total_check",
      sql`${table.totalVnd} = ${table.subtotalVnd} + ${table.shippingVnd} - ${table.discountVnd}`,
    ),
    check(
      "orders_discount_limit_check",
      sql`${table.discountVnd} <= ${table.subtotalVnd} + ${table.shippingVnd}`,
    ),
    check(
      "orders_coupon_check",
      sql`${table.couponId} is null or ${table.discountVnd} > 0`,
    ),
    check(
      "orders_order_number_check",
      sql`${table.orderNumber} ~ '^MB-[0-9A-F]{20}$'`,
    ),
    check(
      "orders_vnpay_reservation_check",
      sql`${table.paymentMethod} <> 'VNPAY' or ${table.reservationExpiresAt} is not null`,
    ),
    check(
      "orders_cancelled_at_check",
      sql`${table.orderStatus} <> 'CANCELLED' or ${table.cancelledAt} is not null`,
    ),
    check(
      "orders_completed_at_check",
      sql`${table.orderStatus} <> 'COMPLETED' or ${table.completedAt} is not null`,
    ),
    index("orders_status_created_idx").on(table.orderStatus, table.createdAt),
    index("orders_payment_status_idx").on(
      table.paymentStatus,
      table.createdAt,
    ),
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    index("orders_created_idx").on(table.createdAt, table.id),
    index("orders_reservation_expiry_idx")
      .on(table.reservationExpiresAt)
      .where(
        sql`${table.orderStatus} = 'PENDING_PAYMENT' and ${table.paymentStatus} = 'PENDING'`,
      ),
  ],
);

export const orderAddresses = pgTable(
  "order_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    line1: text("line_1").notNull(),
    line2: text("line_2"),
    ward: text("ward"),
    district: text("district").notNull(),
    province: text("province").notNull(),
    countryCode: text("country_code").default("VN").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("order_addresses_order_unique").on(table.orderId),
    check("order_addresses_country_check", sql`${table.countryCode} = 'VN'`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productTitle: text("product_title").notNull(),
    variantSku: text("variant_sku").notNull(),
    variantSnapshot: jsonb("variant_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    unitPriceVnd: integer("unit_price_vnd").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalVnd: integer("line_total_vnd").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("order_items_price_check", sql`${table.unitPriceVnd} >= 0`),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    check(
      "order_items_total_check",
      sql`${table.lineTotalVnd} = ${table.unitPriceVnd} * ${table.quantity}`,
    ),
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_variant_id_idx").on(table.variantId),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dimension: text("dimension").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("order_status_history_order_created_idx").on(table.orderId, table.createdAt)],
);
