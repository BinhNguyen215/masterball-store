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

import { orders, paymentStatusEnum } from "./orders";

export const paymentProviderEnum = pgEnum("payment_provider", ["COD", "VNPAY"]);

export const paymentEventKindEnum = pgEnum("payment_event_kind", [
  "IPN",
  "RECONCILIATION",
  "REFUND",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: paymentProviderEnum("provider").notNull(),
    providerReference: text("provider_reference"),
    status: paymentStatusEnum("status").notNull(),
    currency: text("currency").default("VND").notNull(),
    amountVnd: integer("amount_vnd").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("payments_order_provider_unique").on(table.orderId, table.provider),
    unique("payments_provider_reference_unique").on(
      table.provider,
      table.providerReference,
    ),
    check("payments_currency_check", sql`${table.currency} = 'VND'`),
    check("payments_amount_check", sql`${table.amountVnd} >= 0`),
    index("payments_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    provider: paymentProviderEnum("provider").notNull(),
    eventKind: paymentEventKindEnum("event_kind").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    responseCode: text("response_code"),
    transactionStatus: text("transaction_status"),
    amountVnd: integer("amount_vnd"),
    payload: jsonb("payload").$type<Record<string, string>>().notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow().notNull(),
  },
  (table) => [
    unique("payment_events_provider_event_unique").on(
      table.provider,
      table.providerEventId,
    ),
    check(
      "payment_events_amount_check",
      sql`${table.amountVnd} is null or ${table.amountVnd} >= 0`,
    ),
    index("payment_events_payment_processed_idx").on(
      table.paymentId,
      table.processedAt,
    ),
  ],
);

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key").notNull(),
    amountVnd: integer("amount_vnd").notNull(),
    providerReference: text("provider_reference"),
    status: text("status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("payment_refunds_idempotency_unique").on(table.idempotencyKey),
    check("payment_refunds_amount_check", sql`${table.amountVnd} > 0`),
    index("payment_refunds_payment_id_idx").on(table.paymentId),
  ],
);
