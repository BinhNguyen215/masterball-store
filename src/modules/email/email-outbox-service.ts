import { and, asc, eq, lt, lte, or } from "drizzle-orm";

import { getDb, type AppTransaction } from "@/db";
import { emailOutbox } from "@/db/schema";

export type EnqueueEmailInput = {
  orderId?: string | null;
  deduplicationKey: string;
  template: string;
  recipient: string;
  payload: Record<string, unknown>;
};

export async function enqueueEmail(
  tx: AppTransaction,
  input: EnqueueEmailInput,
): Promise<void> {
  await tx
    .insert(emailOutbox)
    .values({
      orderId: input.orderId ?? null,
      deduplicationKey: input.deduplicationKey,
      template: input.template,
      recipient: input.recipient,
      payload: input.payload,
    })
    .onConflictDoNothing({ target: emailOutbox.deduplicationKey });
}

export type EmailSender = (message: {
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

export async function processEmailOutbox(
  sender: EmailSender,
  options: { batchSize?: number; maxAttempts?: number; now?: Date } = {},
) {
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? 20));
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  const now = options.now ?? new Date();
  const staleClaimBefore = new Date(now.getTime() - 10 * 60_000);
  const claimed = await getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(emailOutbox)
      .where(
        or(
          and(
            eq(emailOutbox.status, "PENDING"),
            lte(emailOutbox.nextAttemptAt, now),
          ),
          and(
            eq(emailOutbox.status, "PROCESSING"),
            lt(emailOutbox.updatedAt, staleClaimBefore),
          ),
        ),
      )
      .orderBy(asc(emailOutbox.nextAttemptAt), asc(emailOutbox.id))
      .limit(batchSize)
      .for("update", { skipLocked: true });
    if (rows.length) {
      await tx
        .update(emailOutbox)
        .set({ status: "PROCESSING", updatedAt: now })
        .where(eq(emailOutbox.id, rows[0].id));
      for (const row of rows.slice(1)) {
        await tx
          .update(emailOutbox)
          .set({ status: "PROCESSING", updatedAt: now })
          .where(eq(emailOutbox.id, row.id));
      }
    }
    return rows;
  });

  const result = { sent: 0, retried: 0, failed: 0 };
  for (const message of claimed) {
    try {
      await sender({
        recipient: message.recipient,
        template: message.template,
        payload: message.payload,
      });
      await getDb()
        .update(emailOutbox)
        .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
        .where(
          and(eq(emailOutbox.id, message.id), eq(emailOutbox.status, "PROCESSING")),
        );
      result.sent += 1;
    } catch (error) {
      const attemptCount = message.attemptCount + 1;
      const terminal = attemptCount >= maxAttempts;
      const delayMinutes = Math.min(60, 2 ** attemptCount);
      await getDb()
        .update(emailOutbox)
        .set({
          status: terminal ? "FAILED" : "PENDING",
          attemptCount,
          lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown email error",
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          updatedAt: new Date(),
        })
        .where(
          and(eq(emailOutbox.id, message.id), eq(emailOutbox.status, "PROCESSING")),
        );
      if (terminal) result.failed += 1;
      else result.retried += 1;
    }
  }
  return result;
}
