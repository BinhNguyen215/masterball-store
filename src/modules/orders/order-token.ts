import { createHash, createHmac } from "node:crypto";

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

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
