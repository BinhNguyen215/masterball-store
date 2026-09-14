import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

const auditQuerySchema = z.object({
  actorId: z.string().trim().min(1).optional(),
  subjectType: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function listAuditLogs(input: unknown = {}) {
  const query = auditQuerySchema.parse(input);
  const conditions = [
    query.actorId ? eq(auditLogs.actorId, query.actorId) : undefined,
    query.subjectType ? eq(auditLogs.subjectType, query.subjectType) : undefined,
    query.subjectId ? eq(auditLogs.subjectId, query.subjectId) : undefined,
    query.q
      ? or(
          ilike(auditLogs.action, `%${query.q}%`),
          ilike(auditLogs.subjectType, `%${query.q}%`),
          ilike(auditLogs.subjectId, `%${query.q}%`),
          ilike(auditLogs.actorId, `%${query.q}%`),
          ilike(auditLogs.requestId, `%${query.q}%`),
        )
      : undefined,
  ].filter((condition) => condition !== undefined);

  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ count: count() }).from(auditLogs).where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}
