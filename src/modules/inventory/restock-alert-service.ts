import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, type AppTransaction } from "@/db";
import {
  productVariants,
  products,
  restockAlerts,
} from "@/db/schema";
import { enqueueEmail } from "@/modules/email";

/**
 * "Tell me when this variant is back" requests. The row is the customer's
 * consent: it is never deleted, it is only flipped to NOTIFIED, so the same
 * address can never be written to twice for one restock.
 */
export class RestockAlertError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "UNAVAILABLE",
  ) {
    super(message);
    this.name = "RestockAlertError";
  }
}

/** Mirrors `restock_alerts_email_check`: lower-case, and a dotted host. */
export const RESTOCK_EMAIL_MAX_LENGTH = 254;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** One queue pass reads this many alerts at a time; the loop drains the rest. */
const NOTIFICATION_BATCH_SIZE = 200;
const PENDING_LIST_MAX = 500;

const identifierSchema = z.string().uuid();

/** The address as the database stores it: trimmed and lower-cased. */
export function normalizeRestockEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A guard rather than a parser: it reports whether the address can be stored at
 * all, after normalisation, so the form can reject it before any write.
 */
export function isValidRestockEmail(value: string): boolean {
  const normalized = normalizeRestockEmail(value);
  return normalized.length > 0 && normalized.length <= RESTOCK_EMAIL_MAX_LENGTH && emailPattern.test(normalized);
}

/**
 * Registers one address for one variant. Subscribing twice is not an error: the
 * caller is told the address was already registered, and an address that had
 * cancelled its alert is revived instead of duplicated.
 */
export async function subscribeToRestock(input: {
  variantId: string;
  email: string;
  now?: Date;
}): Promise<{ alreadySubscribed: boolean }> {
  const variantId = identifierSchema.safeParse(input.variantId);
  const email = normalizeRestockEmail(
    typeof input.email === "string" ? input.email : "",
  );
  if (!variantId.success || !isValidRestockEmail(email)) {
    throw new RestockAlertError("The restock request is not valid.", "INVALID");
  }
  const now = input.now ?? new Date();

  return getDb().transaction(async (tx) => {
    const [variant] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.id, variantId.data))
      .limit(1);
    if (!variant) {
      throw new RestockAlertError(
        "This variant is not accepting restock alerts.",
        "UNAVAILABLE",
      );
    }

    const [existing] = await tx
      .select({ id: restockAlerts.id, status: restockAlerts.status })
      .from(restockAlerts)
      .where(
        and(
          eq(restockAlerts.variantId, variantId.data),
          eq(restockAlerts.email, email),
        ),
      )
      .limit(1)
      .for("update");

    if (existing) {
      if (existing.status !== "CANCELLED") return { alreadySubscribed: true };
      await tx
        .update(restockAlerts)
        .set({ status: "PENDING", notifiedAt: null, updatedAt: now })
        .where(eq(restockAlerts.id, existing.id));
      return { alreadySubscribed: false };
    }

    // `restock_alerts_variant_email_unique` is the subscription guard; a lost
    // race resolves to "already subscribed" rather than a constraint error.
    const inserted = await tx
      .insert(restockAlerts)
      .values({
        variantId: variantId.data,
        email,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [restockAlerts.variantId, restockAlerts.email],
      })
      .returning({ id: restockAlerts.id });

    return { alreadySubscribed: inserted.length === 0 };
  });
}

/** Waiting addresses for one variant, oldest first. */
export async function listPendingRestockAlerts(
  variantId: string,
  limit = 200,
): Promise<{ id: string; email: string }[]> {
  const parsed = identifierSchema.safeParse(variantId);
  if (!parsed.success) return [];
  const bounded = Math.max(
    1,
    Math.min(PENDING_LIST_MAX, Number.isFinite(limit) ? Math.trunc(limit) : 200),
  );

  return getDb()
    .select({ id: restockAlerts.id, email: restockAlerts.email })
    .from(restockAlerts)
    .where(
      and(
        eq(restockAlerts.variantId, parsed.data),
        eq(restockAlerts.status, "PENDING"),
      ),
    )
    .orderBy(asc(restockAlerts.createdAt), asc(restockAlerts.id))
    .limit(bounded);
}

/**
 * Called by the inventory write paths when available stock rises above zero:
 * queues one outbox email per waiting alert and flips those alerts to NOTIFIED
 * in the caller's own transaction, so a committed restock and its notifications
 * cannot diverge. The `NOTIFIED` flip is the write that makes a second pass a
 * no-op; the outbox de-duplication key is the alert's own id, so a re-run
 * enqueues nothing. Rows locked by a concurrent pass are skipped and picked up
 * by the next restock. Returns how many alerts were notified.
 */
export async function queueRestockNotifications(
  tx: AppTransaction,
  variantId: string,
  now: Date,
): Promise<number> {
  const [variant] = await tx
    .select({
      sku: productVariants.sku,
      productTitle: products.title,
      productSlug: products.slug,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId))
    .limit(1);
  if (!variant) return 0;

  const publicBaseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const payload = {
    productTitle: variant.productTitle,
    // The variant label is the SKU everywhere the shop shows one (cart,
    // checkout, order history), so the notification speaks the same language.
    variantLabel: variant.sku,
    sku: variant.sku,
    // The email renderer requires an absolute URL, so the link is omitted
    // entirely when the deployment publishes no public base URL.
    ...(/^https?:\/\/\S+$/.test(publicBaseUrl)
      ? { productUrl: `${publicBaseUrl}/products/${variant.productSlug}` }
      : {}),
  };

  let notified = 0;
  for (;;) {
    const pending = await tx
      .select({ id: restockAlerts.id, email: restockAlerts.email })
      .from(restockAlerts)
      .where(
        and(
          eq(restockAlerts.variantId, variantId),
          eq(restockAlerts.status, "PENDING"),
        ),
      )
      .orderBy(asc(restockAlerts.createdAt), asc(restockAlerts.id))
      .limit(NOTIFICATION_BATCH_SIZE)
      .for("update", { skipLocked: true });
    if (!pending.length) break;

    for (const alert of pending) {
      await enqueueEmail(tx, {
        deduplicationKey: `restock-available:${alert.id}`,
        template: "restock-available",
        recipient: alert.email,
        payload,
      });
    }
    await tx
      .update(restockAlerts)
      .set({ status: "NOTIFIED", notifiedAt: now, updatedAt: now })
      .where(
        inArray(
          restockAlerts.id,
          pending.map((alert) => alert.id),
        ),
      );
    notified += pending.length;
    if (pending.length < NOTIFICATION_BATCH_SIZE) break;
  }

  return notified;
}
