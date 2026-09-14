import type { AppTransaction } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
};

export async function appendAuditLog(
  tx: AppTransaction,
  input: AuditInput,
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: input.actorId ?? null,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.requestId ?? null,
  });
}
