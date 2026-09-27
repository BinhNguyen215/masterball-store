import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  tournamentRegistrationPaymentStatusEnum,
  tournamentRegistrationStatusEnum,
  tournamentRegistrations,
  tournaments,
} from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

export type RegistrationStatus =
  (typeof tournamentRegistrationStatusEnum.enumValues)[number];
export type RegistrationPaymentStatus =
  (typeof tournamentRegistrationPaymentStatusEnum.enumValues)[number];

/** A seat is only ever taken through the guest form or the admin console. */
export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CLOSED" | "DUPLICATE" | "INVALID",
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

/** One seat as the admin console renders it, with its tournament resolved. */
export type RegistrationRow = {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentSlug: string;
  fullName: string;
  phone: string;
  email: string | null;
  note: string | null;
  status: RegistrationStatus;
  paymentStatus: RegistrationPaymentStatus;
  paidAt: Date | null;
  checkedInAt: Date | null;
  cancelledAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RegistrationSummary = {
  tournamentId: string;
  capacity: number | null;
  feeVnd: number;
  registered: number;
  waitlisted: number;
  registrationOpen: boolean;
};

/**
 * Capacity decision for one new seat: an uncapped event always takes the seat,
 * a capped event queues every request once the seats already taken reach the
 * cap. Pure so the storefront and the tests can reach it without a database.
 */
export function decideRegistrationPlacement(input: {
  registered: number;
  capacity: number | null;
}): "REGISTERED" | "WAITLISTED" {
  if (input.capacity === null) return "REGISTERED";
  return input.registered >= input.capacity ? "WAITLISTED" : "REGISTERED";
}

/**
 * The public registration gate. Seats are taken only while the event is
 * published, not cancelled, and before its deadline when it has one.
 */
export function isRegistrationOpen(
  tournament: {
    cancelled: boolean;
    publicationStatus: string;
    registrationDeadline: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (tournament.cancelled) return false;
  if (tournament.publicationStatus !== "PUBLISHED") return false;
  if (
    tournament.registrationDeadline &&
    now.getTime() > tournament.registrationDeadline.getTime()
  ) {
    return false;
  }
  return true;
}

/** Empty optional fields are absent, not empty strings the database would store. */
const trimToNull = (value: unknown) => {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const optionalText = (max: number) =>
  z.preprocess(trimToNull, z.string().max(max).nullable());

/**
 * Guest input the storefront collects. Mirrors the database checks so a bad
 * submission fails with a typed error instead of a constraint violation.
 */
const registrationInputSchema = z.object({
  slug: z.string().trim().min(1).max(180),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[0-9+][0-9 .-]{7,19}$/),
  email: z.preprocess(trimToNull, z.string().max(254).email().nullable()),
  note: optionalText(1000),
});

const statusFilterSchema = z.enum(tournamentRegistrationStatusEnum.enumValues);
const identifierSchema = z.string().uuid();
const targetStatusSchema = z.enum(["CHECKED_IN", "CANCELLED"]);
const paymentStatusSchema = z.enum(["PAID", "WAIVED"]);
const versionSchema = z.number().int().positive();

/**
 * Public counters for one event, read by the storefront registration panel.
 * Returns `null` for a slug that does not exist so the page can keep its own
 * "not found" handling.
 */
export async function getTournamentRegistrationSummary(
  slug: string,
): Promise<RegistrationSummary | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const [tournament] = await getDb()
    .select({
      id: tournaments.id,
      capacity: tournaments.capacity,
      feeVnd: tournaments.feeVnd,
      cancelled: tournaments.cancelled,
      publicationStatus: tournaments.publicationStatus,
      registrationDeadline: tournaments.registrationDeadline,
    })
    .from(tournaments)
    .where(eq(tournaments.slug, trimmed))
    .limit(1);
  if (!tournament) return null;

  const rows = await getDb()
    .select({ status: tournamentRegistrations.status, total: count() })
    .from(tournamentRegistrations)
    .where(eq(tournamentRegistrations.tournamentId, tournament.id))
    .groupBy(tournamentRegistrations.status);

  let registered = 0;
  let waitlisted = 0;
  for (const row of rows) {
    const total = Number(row.total);
    if (row.status === "REGISTERED" || row.status === "CHECKED_IN") registered += total;
    if (row.status === "WAITLISTED") waitlisted += total;
  }

  return {
    tournamentId: tournament.id,
    capacity: tournament.capacity,
    feeVnd: tournament.feeVnd,
    registered,
    waitlisted,
    registrationOpen: isRegistrationOpen(tournament),
  };
}

/**
 * Take a seat for a guest. The tournament row is locked for the whole decision
 * so two simultaneous requests cannot both see the last free seat, and a phone
 * number keeps exactly one row per event: re-submitting from a phone that
 * already holds a seat is reported instead of duplicated, and a cancelled seat
 * is revived rather than rejected.
 */
export async function registerForTournament(input: {
  slug: string;
  fullName: string;
  phone: string;
  email?: string | null;
  note?: string | null;
  now?: Date;
}): Promise<{ status: "REGISTERED" | "WAITLISTED"; alreadyRegistered: boolean }> {
  const parsed = registrationInputSchema.safeParse({
    slug: input.slug,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    note: input.note,
  });
  if (!parsed.success) {
    throw new RegistrationError("The registration details are not valid.", "INVALID");
  }
  const now = input.now ?? new Date();

  return getDb().transaction(async (tx) => {
    const [tournament] = await tx
      .select({
        id: tournaments.id,
        capacity: tournaments.capacity,
        cancelled: tournaments.cancelled,
        publicationStatus: tournaments.publicationStatus,
        registrationDeadline: tournaments.registrationDeadline,
      })
      .from(tournaments)
      .where(eq(tournaments.slug, parsed.data.slug))
      .limit(1)
      .for("update");
    if (!tournament) {
      throw new RegistrationError("Tournament was not found.", "NOT_FOUND");
    }
    if (!isRegistrationOpen(tournament, now)) {
      throw new RegistrationError("Registration is closed.", "CLOSED");
    }

    const [existing] = await tx
      .select({
        id: tournamentRegistrations.id,
        status: tournamentRegistrations.status,
        version: tournamentRegistrations.version,
      })
      .from(tournamentRegistrations)
      .where(
        and(
          eq(tournamentRegistrations.tournamentId, tournament.id),
          eq(tournamentRegistrations.phone, parsed.data.phone),
        ),
      )
      .limit(1);

    if (existing && existing.status !== "CANCELLED") {
      return {
        status: existing.status === "WAITLISTED" ? ("WAITLISTED" as const) : ("REGISTERED" as const),
        alreadyRegistered: true,
      };
    }

    // Only seats that are actually held count against the cap, so the counter
    // matches the `registered` the storefront shows: a waitlisted person does
    // not occupy a seat, and a cancelled one frees it.
    const [takenRow] = await tx
      .select({ total: count() })
      .from(tournamentRegistrations)
      .where(
        and(
          eq(tournamentRegistrations.tournamentId, tournament.id),
          inArray(tournamentRegistrations.status, ["REGISTERED", "CHECKED_IN"]),
        ),
      );
    const status = decideRegistrationPlacement({
      registered: Number(takenRow?.total ?? 0),
      capacity: tournament.capacity,
    });

    const seat = {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      note: parsed.data.note,
      status,
      paymentStatus: "UNPAID" as const,
      paidAt: null,
      checkedInAt: null,
      cancelledAt: null,
      updatedAt: now,
    };

    const [row] = existing
      ? await tx
          .update(tournamentRegistrations)
          .set({ ...seat, version: sql`${tournamentRegistrations.version} + 1` })
          .where(eq(tournamentRegistrations.id, existing.id))
          .returning()
      : await tx
          .insert(tournamentRegistrations)
          .values({
            tournamentId: tournament.id,
            phone: parsed.data.phone,
            ...seat,
          })
          .returning();

    await appendAuditLog(tx, {
      actorId: null,
      action: "tournament.registration.create",
      subjectType: "tournament_registration",
      subjectId: row.id,
      before: existing
        ? { status: existing.status, version: existing.version }
        : null,
      after: {
        tournamentId: tournament.id,
        status: row.status,
        paymentStatus: row.paymentStatus,
        version: row.version,
      },
    });

    // A revived seat is a fresh registration, not a duplicate: the customer
    // cancelled earlier and just took the seat again.
    return { status, alreadyRegistered: false };
  });
}

/**
 * Paged admin listing. An unknown tournament id or status matches nothing
 * instead of raising, so a stale filter link is an empty table, not an error.
 */
export async function listTournamentRegistrations(input: {
  tournamentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: RegistrationRow[]; total: number }> {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const conditions: SQL[] = [];

  if (input.tournamentId?.trim()) {
    const tournamentId = identifierSchema.safeParse(input.tournamentId.trim());
    conditions.push(
      tournamentId.success
        ? eq(tournamentRegistrations.tournamentId, tournamentId.data)
        : sql`false`,
    );
  }
  if (input.status?.trim()) {
    const status = statusFilterSchema.safeParse(input.status.trim());
    conditions.push(
      status.success ? eq(tournamentRegistrations.status, status.data) : sql`false`,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const db = getDb();
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        registration: tournamentRegistrations,
        tournamentTitle: tournaments.title,
        tournamentSlug: tournaments.slug,
      })
      .from(tournamentRegistrations)
      .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
      .where(where)
      .orderBy(
        desc(tournamentRegistrations.createdAt),
        desc(tournamentRegistrations.id),
      )
      .limit(limit)
      .offset(offset),
    // Bounded counterpart of a full count: one row past the requested page,
    // which is all the console needs to paginate.
    db
      .select({ count: count() })
      .from(
        db
          .select({ id: tournamentRegistrations.id })
          .from(tournamentRegistrations)
          .where(where)
          .limit(offset + limit + 1)
          .as("bounded_registration_page"),
      ),
  ]);

  return {
    items: rows.map(({ registration, tournamentTitle, tournamentSlug }) => ({
      id: registration.id,
      tournamentId: registration.tournamentId,
      tournamentTitle,
      tournamentSlug,
      fullName: registration.fullName,
      phone: registration.phone,
      email: registration.email,
      note: registration.note,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      paidAt: registration.paidAt,
      checkedInAt: registration.checkedInAt,
      cancelledAt: registration.cancelledAt,
      version: registration.version,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
    })),
    total: Number(totalRow?.count ?? 0),
  };
}

/**
 * Walk a seat to the desk or cancel it. The timestamp column the database
 * requires for each target status is stamped here, and the version guard turns
 * a stale console tab into a refusal rather than a silent overwrite.
 */
export async function setRegistrationStatus(input: {
  registrationId: string;
  expectedVersion: number;
  actorId: string;
  toStatus: "CHECKED_IN" | "CANCELLED";
  note?: string | null;
}): Promise<void> {
  const registrationId = identifierSchema.safeParse(input.registrationId);
  const toStatus = targetStatusSchema.safeParse(input.toStatus);
  const expectedVersion = versionSchema.safeParse(input.expectedVersion);
  if (
    !registrationId.success ||
    !toStatus.success ||
    !expectedVersion.success ||
    !input.actorId
  ) {
    throw new RegistrationError("The registration update is not valid.", "INVALID");
  }
  const now = new Date();

  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.id, registrationId.data))
      .limit(1)
      .for("update");
    if (!before) {
      throw new RegistrationError("Registration was not found.", "NOT_FOUND");
    }
    if (before.version !== expectedVersion.data) {
      throw new RegistrationError(
        "Registration was changed by another request.",
        "INVALID",
      );
    }

    const [after] = await tx
      .update(tournamentRegistrations)
      .set({
        status: toStatus.data,
        checkedInAt:
          toStatus.data === "CHECKED_IN" ? (before.checkedInAt ?? now) : before.checkedInAt,
        cancelledAt:
          toStatus.data === "CANCELLED" ? (before.cancelledAt ?? now) : before.cancelledAt,
        note: input.note === undefined ? before.note : input.note,
        version: sql`${tournamentRegistrations.version} + 1`,
        updatedAt: now,
      })
      .where(eq(tournamentRegistrations.id, before.id))
      .returning();

    await appendAuditLog(tx, {
      actorId: input.actorId,
      action:
        toStatus.data === "CHECKED_IN"
          ? "tournament.registration.check-in"
          : "tournament.registration.cancel",
      subjectType: "tournament_registration",
      subjectId: before.id,
      before,
      after,
    });
  });
}

/**
 * Settle the entry fee at the counter: `PAID` stamps the payment time the
 * database requires, `WAIVED` clears it so a waived seat never claims a
 * payment it did not take.
 */
export async function settleRegistrationFee(input: {
  registrationId: string;
  expectedVersion: number;
  actorId: string;
  paymentStatus: "PAID" | "WAIVED";
}): Promise<void> {
  const registrationId = identifierSchema.safeParse(input.registrationId);
  const paymentStatus = paymentStatusSchema.safeParse(input.paymentStatus);
  const expectedVersion = versionSchema.safeParse(input.expectedVersion);
  if (
    !registrationId.success ||
    !paymentStatus.success ||
    !expectedVersion.success ||
    !input.actorId
  ) {
    throw new RegistrationError("The fee settlement is not valid.", "INVALID");
  }
  const now = new Date();

  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.id, registrationId.data))
      .limit(1)
      .for("update");
    if (!before) {
      throw new RegistrationError("Registration was not found.", "NOT_FOUND");
    }
    if (before.version !== expectedVersion.data) {
      throw new RegistrationError(
        "Registration was changed by another request.",
        "INVALID",
      );
    }

    const [after] = await tx
      .update(tournamentRegistrations)
      .set({
        paymentStatus: paymentStatus.data,
        paidAt: paymentStatus.data === "PAID" ? (before.paidAt ?? now) : null,
        version: sql`${tournamentRegistrations.version} + 1`,
        updatedAt: now,
      })
      .where(eq(tournamentRegistrations.id, before.id))
      .returning();

    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "tournament.registration.settle-fee",
      subjectType: "tournament_registration",
      subjectId: before.id,
      before,
      after,
    });
  });
}
