import { sql } from "drizzle-orm";
import {
  boolean,
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
import { games } from "./catalog";

export const tournamentPublicationStatusEnum = pgEnum(
  "tournament_publication_status",
  ["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"],
);

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    rules: text("rules").notNull(),
    bannerObjectKey: text("banner_object_key"),
    venueName: text("venue_name"),
    address: text("address"),
    onlineUrl: text("online_url"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" })
      .notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    registrationDeadline: timestamp("registration_deadline", {
      withTimezone: true,
      mode: "date",
    }),
    timezone: text("timezone").default("Asia/Ho_Chi_Minh").notNull(),
    capacity: integer("capacity"),
    feeVnd: integer("fee_vnd").default(0).notNull(),
    contact: text("contact"),
    ctaUrl: text("cta_url"),
    publicationStatus: tournamentPublicationStatusEnum("publication_status")
      .default("DRAFT")
      .notNull(),
    scheduledPublishAt: timestamp("scheduled_publish_at", {
      withTimezone: true,
      mode: "date",
    }),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    cancelled: boolean("cancelled").default(false).notNull(),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("tournaments_slug_unique").on(table.slug),
    check("tournaments_time_check", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "tournaments_deadline_check",
      sql`${table.registrationDeadline} is null or ${table.registrationDeadline} <= ${table.startsAt}`,
    ),
    check(
      "tournaments_location_check",
      sql`${table.venueName} is not null or ${table.onlineUrl} is not null`,
    ),
    check(
      "tournaments_schedule_check",
      sql`${table.publicationStatus} <> 'SCHEDULED' or ${table.scheduledPublishAt} is not null`,
    ),
    check("tournaments_capacity_check", sql`${table.capacity} is null or ${table.capacity} > 0`),
    check("tournaments_fee_check", sql`${table.feeVnd} >= 0`),
    check("tournaments_version_check", sql`${table.version} > 0`),
    check(
      "tournaments_cancelled_at_check",
      sql`not ${table.cancelled} or ${table.cancelledAt} is not null`,
    ),
    index("tournaments_public_starts_idx").on(
      table.publicationStatus,
      table.startsAt,
    ),
    index("tournaments_game_starts_idx").on(table.gameId, table.startsAt),
    index("tournaments_scheduled_publish_idx").on(
      table.publicationStatus,
      table.scheduledPublishAt,
    ),
    index("tournaments_updated_idx").on(table.updatedAt, table.id),
    index("tournaments_title_trgm_idx").using(
      "gin",
      sql`${table.title} gin_trgm_ops`,
    ),
  ],
);

export const tournamentRegistrationStatusEnum = pgEnum(
  "tournament_registration_status",
  ["REGISTERED", "WAITLISTED", "CHECKED_IN", "CANCELLED"],
);

export const tournamentRegistrationPaymentStatusEnum = pgEnum(
  "tournament_registration_payment_status",
  ["UNPAID", "PAID", "WAIVED"],
);

/**
 * A seat in a tournament. Capacity is enforced transactionally against the
 * number of non-cancelled rows, so `WAITLISTED` is a real queue position rather
 * than a rejection; a phone number can hold one seat per tournament.
 */
export const tournamentRegistrations = pgTable(
  "tournament_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    note: text("note"),
    status: tournamentRegistrationStatusEnum("status")
      .default("REGISTERED")
      .notNull(),
    paymentStatus: tournamentRegistrationPaymentStatusEnum("payment_status")
      .default("UNPAID")
      .notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("tournament_registrations_tournament_phone_unique").on(
      table.tournamentId,
      table.phone,
    ),
    check(
      "tournament_registrations_name_check",
      sql`length(btrim(${table.fullName})) between 2 and 120`,
    ),
    check(
      "tournament_registrations_phone_check",
      sql`${table.phone} ~ '^[0-9+][0-9 .-]{7,19}$'`,
    ),
    check(
      "tournament_registrations_checked_in_check",
      sql`${table.status} <> 'CHECKED_IN' or ${table.checkedInAt} is not null`,
    ),
    check(
      "tournament_registrations_cancelled_check",
      sql`${table.status} <> 'CANCELLED' or ${table.cancelledAt} is not null`,
    ),
    check(
      "tournament_registrations_paid_check",
      sql`${table.paymentStatus} <> 'PAID' or ${table.paidAt} is not null`,
    ),
    check("tournament_registrations_version_check", sql`${table.version} > 0`),
    index("tournament_registrations_tournament_status_idx").on(
      table.tournamentId,
      table.status,
      table.createdAt,
    ),
  ],
);
