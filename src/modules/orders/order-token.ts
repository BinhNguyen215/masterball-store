import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function requireOrderSecret(): string {
  const secret = (process.env.ORDER_LOOKUP_SECRET ?? process.env.BETTER_AUTH_SECRET)?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "ORDER_LOOKUP_SECRET or BETTER_AUTH_SECRET with at least 32 characters is required.",
    );
  }
  return secret;
}

function derive(label: string, idempotencyKey: string): Buffer {
  return createHmac("sha256", requireOrderSecret())
    .update(`${label}:${idempotencyKey}`)
    .digest();
}

export function createOrderIdentity(idempotencyKey: string) {
  const lookupToken = derive("lookup", idempotencyKey).toString("base64url");
  const orderNumber = `MB-${derive("order", idempotencyKey)
    .toString("hex")
    .slice(0, 20)
    .toUpperCase()}`;
  return { orderNumber, lookupToken, lookupTokenHash: hashOrderLookupToken(lookupToken) };
}

export function hashOrderLookupToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const orderAccessLabel = "order-access";
const orderAccessPattern =
  /^(\d{1,15})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

/**
 * Short-lived proof that a visitor already verified one order by order number
 * and phone. It is stored in an httpOnly cookie so a verified guest can reopen
 * the order page without keeping the permanent lookup token in the URL.
 */
export function createOrderAccessToken(
  orderId: string,
  options: { now?: Date; ttlMs?: number } = {},
): string {
  const expiresAt = (options.now ?? new Date()).getTime() + (options.ttlMs ?? 30 * 60_000);
  const payload = `${expiresAt}.${orderId}`;
  return `${payload}.${derive(orderAccessLabel, payload).toString("base64url")}`;
}

export function verifyOrderAccessToken(
  token: string,
  now: Date = new Date(),
): { orderId: string } | null {
  const match = orderAccessPattern.exec(token);
  if (!match) return null;
  const [, expiresAtText, orderId, signature] = match;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return null;
  const expected = derive(orderAccessLabel, `${expiresAtText}.${orderId}`);
  const provided = Buffer.from(signature, "base64url");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  return { orderId };
}

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
