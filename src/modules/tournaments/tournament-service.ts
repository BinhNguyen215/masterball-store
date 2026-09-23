import { and, asc, count, desc, eq, gt, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { games, tournaments } from "@/db/schema";
import { appendAuditLog } from "@/modules/audit";

const safeHttpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"));

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  safeHttpUrl.nullable(),
);

const tournamentInputObject = z.object({
    gameId: z.string().uuid(),
    title: z.string().trim().min(1).max(250),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    summary: z.string().trim().min(1).max(1000),
    rules: z.string().trim().min(1).max(50_000),
    bannerObjectKey: z.string().trim().max(500).nullable().optional(),
    venueName: z.string().trim().max(250).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    onlineUrl: optionalUrl,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    registrationDeadline: z.coerce.date().nullable().optional(),
    timezone: z.string().trim().default("Asia/Ho_Chi_Minh"),
    capacity: z.number().int().positive().nullable().optional(),
    feeVnd: z.number().int().min(0).max(2_147_483_647).default(0),
    contact: z.string().trim().max(250).nullable().optional(),
    ctaUrl: optionalUrl,
  });

export const tournamentInputSchema = tournamentInputObject.superRefine((value, context) => {
    if (value.startsAt >= value.endsAt) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must be after startsAt" });
    }
    if (value.registrationDeadline && value.registrationDeadline > value.startsAt) {
      context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "registrationDeadline must not be after startsAt" });
    }
    if (!value.venueName && !value.onlineUrl) {
      context.addIssue({ code: "custom", path: ["venueName"], message: "A venue or online URL is required" });
    }
  });

const publicationTransitions = {
  DRAFT: ["SCHEDULED", "PUBLISHED", "ARCHIVED"],
  SCHEDULED: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["UNPUBLISHED", "ARCHIVED"],
  UNPUBLISHED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
} as const;

export class TournamentError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "VERSION_CONFLICT" | "INVALID_STATE") {
    super(message);
    this.name = "TournamentError";
  }
}

export function getTournamentTiming(
  tournament: { startsAt: Date; endsAt: Date; cancelled: boolean },
  now = new Date(),
) {
  if (tournament.cancelled) return "CANCELLED" as const;
  if (now < tournament.startsAt) return "UPCOMING" as const;
  if (now <= tournament.endsAt) return "IN_PROGRESS" as const;
  return "ENDED" as const;
}

export async function createTournament(raw: unknown) {
  const context = z.object({ actorId: z.string().min(1), requestId: z.string().optional() }).parse(raw);
  const input = tournamentInputSchema.parse(raw);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(tournaments)
      .values({ ...input, createdBy: context.actorId, updatedBy: context.actorId })
      .returning();
    await appendAuditLog(tx, {
      actorId: context.actorId,
      action: "tournament.create",
      subjectType: "tournament",
      subjectId: created.id,
      after: created,
      requestId: context.requestId,
    });
    return created;
  });
}

export async function updateTournament(raw: unknown) {
  const context = z
    .object({
      id: z.string().uuid(),
      expectedVersion: z.number().int().positive(),
      actorId: z.string().min(1),
      requestId: z.string().optional(),
      changes: tournamentInputObject.partial(),
    })
    .parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, context.id))
      .limit(1)
      .for("update");
    if (!before) throw new TournamentError("Tournament was not found.", "NOT_FOUND");
    if (before.version !== context.expectedVersion) {
      throw new TournamentError("Tournament was changed by another request.", "VERSION_CONFLICT");
    }
    if (before.publicationStatus === "ARCHIVED") {
      throw new TournamentError("Archived tournaments cannot be edited.", "INVALID_STATE");
    }
    const merged = tournamentInputSchema.parse({ ...before, ...context.changes });
    const [updated] = await tx
      .update(tournaments)
      .set({
        ...merged,
        updatedBy: context.actorId,
        version: sql`${tournaments.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(tournaments.id, before.id), eq(tournaments.version, context.expectedVersion)))
      .returning();
    await appendAuditLog(tx, {
      actorId: context.actorId,
      action: "tournament.update",
      subjectType: "tournament",
      subjectId: before.id,
      before,
      after: updated,
      requestId: context.requestId,
    });
    return updated;
  });
}

export async function transitionTournament(raw: unknown) {
  const input = z
    .object({
      id: z.string().uuid(),
      expectedVersion: z.number().int().positive(),
      actorId: z.string().min(1),
      toStatus: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]).optional(),
      scheduledPublishAt: z.coerce.date().nullable().optional(),
      cancelled: z.boolean().optional(),
    })
    .refine(
      (value) => value.toStatus !== undefined || value.cancelled !== undefined,
      { message: "A target status or a cancellation flag is required." },
    )
    .parse(raw);
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, input.id))
      .limit(1)
      .for("update");
    if (!before) throw new TournamentError("Tournament was not found.", "NOT_FOUND");
    if (before.version !== input.expectedVersion) {
      throw new TournamentError("Tournament was changed by another request.", "VERSION_CONFLICT");
    }
    const toStatus = input.toStatus ?? before.publicationStatus;
    const allowed = publicationTransitions[before.publicationStatus] as readonly string[];
    if (toStatus !== before.publicationStatus && !allowed.includes(toStatus)) {
      throw new TournamentError(
        `Tournament cannot transition from ${before.publicationStatus} to ${toStatus}.`,
        "INVALID_STATE",
      );
    }
    if (toStatus === "SCHEDULED" && !input.scheduledPublishAt) {
      throw new TournamentError("Scheduled publishing requires a future time.", "INVALID_STATE");
    }
    tournamentInputSchema.parse(before);
    const now = new Date();
    const [updated] = await tx
      .update(tournaments)
      .set({
        publicationStatus: toStatus,
        scheduledPublishAt:
          toStatus === "SCHEDULED" ? input.scheduledPublishAt : null,
        publishedAt:
          toStatus === "PUBLISHED" ? (before.publishedAt ?? now) : before.publishedAt,
        cancelled: input.cancelled ?? before.cancelled,
        cancelledAt:
          input.cancelled === true ? now : input.cancelled === false ? null : before.cancelledAt,
        updatedBy: input.actorId,
        version: sql`${tournaments.version} + 1`,
        updatedAt: now,
      })
      .where(eq(tournaments.id, before.id))
      .returning();
    await appendAuditLog(tx, {
      actorId: input.actorId,
      action: "tournament.status",
      subjectType: "tournament",
      subjectId: before.id,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function publishScheduledTournaments(
  options: { now?: Date; batchSize?: number } = {},
) {
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, Math.min(200, options.batchSize ?? 50));
  return getDb().transaction(async (tx) => {
    const due = await tx
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.publicationStatus, "SCHEDULED"),
          lte(tournaments.scheduledPublishAt, now),
        ),
      )
      .orderBy(asc(tournaments.id))
      .limit(batchSize)
      .for("update", { skipLocked: true });
    for (const tournament of due) {
      tournamentInputSchema.parse(tournament);
      await tx
        .update(tournaments)
        .set({
          publicationStatus: "PUBLISHED",
          scheduledPublishAt: null,
          publishedAt: tournament.publishedAt ?? now,
          version: sql`${tournaments.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(tournaments.id, tournament.id),
            eq(tournaments.publicationStatus, "SCHEDULED"),
          ),
        );
      await appendAuditLog(tx, {
        actorId: null,
        action: "tournament.scheduled.publish",
        subjectType: "tournament",
        subjectId: tournament.id,
        before: {
          publicationStatus: tournament.publicationStatus,
          scheduledPublishAt: tournament.scheduledPublishAt,
          version: tournament.version,
        },
        after: {
          publicationStatus: "PUBLISHED",
          publishedAt: tournament.publishedAt ?? now,
          version: tournament.version + 1,
        },
      });
    }
    return due.map((tournament) => tournament.id);
  });
}

export async function listPublishedTournaments(
  input: { game?: string; timing?: "upcoming" | "past" | "all"; limit?: number } = {},
) {
  const now = new Date();
  const limit = Math.max(1, Math.min(100, input.limit ?? 24));
  const timing = input.timing ?? "all";
  const rows = await getDb()
    .select({ tournament: tournaments, game: { id: games.id, name: games.name, slug: games.slug } })
    .from(tournaments)
    .innerJoin(games, eq(games.id, tournaments.gameId))
    .where(
      and(
        eq(tournaments.publicationStatus, "PUBLISHED"),
        input.game ? eq(games.slug, input.game) : undefined,
        timing === "upcoming" ? gt(tournaments.endsAt, now) : undefined,
        timing === "past" ? lte(tournaments.endsAt, now) : undefined,
      ),
    )
    .orderBy(asc(tournaments.startsAt), asc(tournaments.id))
    .limit(limit);
  return rows.map(({ tournament, game }) => ({
    ...tournament,
    game,
    timing: getTournamentTiming(tournament, now),
  }));
}

export async function getPublishedTournamentBySlug(slug: string) {
  const [row] = await getDb()
    .select({ tournament: tournaments, game: { id: games.id, name: games.name, slug: games.slug } })
    .from(tournaments)
    .innerJoin(games, eq(games.id, tournaments.gameId))
    .where(
      and(
        eq(tournaments.slug, slug.trim()),
        eq(tournaments.publicationStatus, "PUBLISHED"),
      ),
    )
    .limit(1);
  return row
    ? { ...row.tournament, game: row.game, timing: getTournamentTiming(row.tournament) }
    : null;
}

export async function listPublishedTournamentSitemapEntries() {
  return getDb()
    .select({ slug: tournaments.slug, updatedAt: tournaments.updatedAt })
    .from(tournaments)
    .where(eq(tournaments.publicationStatus, "PUBLISHED"))
    .orderBy(asc(tournaments.slug));
}

export async function listAdminTournaments(input: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
} = {}) {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const conditions: SQL[] = [];
  if (input.q?.trim()) {
    const pattern = `%${input.q.trim()}%`;
    conditions.push(or(
      ilike(tournaments.title, pattern),
      ilike(tournaments.slug, pattern),
      ilike(games.name, pattern),
    )!);
  }
  if (input.status === "CANCELLED") {
    conditions.push(eq(tournaments.cancelled, true));
  } else if (input.status) {
    conditions.push(sql`${tournaments.publicationStatus}::text = ${input.status}`);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
    .select({ tournament: tournaments, gameName: games.name })
    .from(tournaments)
    .innerJoin(games, eq(games.id, tournaments.gameId))
    .where(where)
    .orderBy(desc(tournaments.updatedAt), desc(tournaments.id))
    .limit(limit)
    .offset(offset),
    db
      .select({ count: count() })
      .from(tournaments)
      .innerJoin(games, eq(games.id, tournaments.gameId))
      .where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}
