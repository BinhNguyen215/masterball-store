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

import { products } from "./catalog";
import { orders } from "./orders";

export const reviewStatusEnum = pgEnum("review_status", [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
]);

/**
 * Customer reviews. A review may only be submitted by someone who holds an
 * order number and the phone number used at checkout, so `order_id` records the
 * verified purchase; a product can be reviewed once per order.
 */
export const productReviews = pgTable(
  "product_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    status: reviewStatusEnum("status").default("PENDING").notNull(),
    moderatedBy: text("moderated_by"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("product_reviews_order_product_unique").on(
      table.orderId,
      table.productId,
    ),
    check(
      "product_reviews_rating_check",
      sql`${table.rating} between 1 and 5`,
    ),
    check(
      "product_reviews_author_check",
      sql`length(btrim(${table.authorName})) between 2 and 120`,
    ),
    check(
      "product_reviews_body_check",
      sql`length(btrim(${table.body})) between 10 and 2000`,
    ),
    check(
      "product_reviews_published_check",
      sql`${table.status} <> 'PUBLISHED' or ${table.publishedAt} is not null`,
    ),
    index("product_reviews_product_status_created_idx").on(
      table.productId,
      table.status,
      table.createdAt,
    ),
    index("product_reviews_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
