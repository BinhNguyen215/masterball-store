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

import { orders } from "./orders";

export const emailOutboxStatusEnum = pgEnum("email_outbox_status", [
  "PENDING",
  "PROCESSING",
  "SENT",
  "FAILED",
]);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "restrict",
    }),
    deduplicationKey: text("deduplication_key").notNull(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: emailOutboxStatusEnum("status").default("PENDING").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow().notNull(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("email_outbox_deduplication_unique").on(table.deduplicationKey),
    check("email_outbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
    index("email_outbox_delivery_idx").on(table.status, table.nextAttemptAt),
    index("email_outbox_order_id_idx").on(table.orderId),
  ],
);
