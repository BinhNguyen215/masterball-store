import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function requireCartSecret(): string {
  const secret = (process.env.CART_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET)?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "CART_TOKEN_SECRET or BETTER_AUTH_SECRET with at least 32 characters is required.",
    );
  }
  return secret;
}

function sign(value: string): Buffer {
  return createHmac("sha256", requireCartSecret()).update(value).digest();
}

export function createCartToken(): { token: string; tokenHash: string } {
  const opaque = randomBytes(32).toString("base64url");
  const signature = sign(opaque).toString("base64url");
  return { token: `${opaque}.${signature}`, tokenHash: hashCartToken(opaque) };
}

export function hashCartToken(opaque: string): string {
  return createHash("sha256").update(opaque).digest("hex");
}

export function verifyAndHashCartToken(token: string): string | null {
  const [opaque, encodedSignature, extra] = token.split(".");
  if (!opaque || !encodedSignature || extra) return null;
  let received: Buffer;
  try {
    received = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  const expected = sign(opaque);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }
  return hashCartToken(opaque);
}
