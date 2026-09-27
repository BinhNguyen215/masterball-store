import { isIP } from "node:net";

/**
 * Reads the client IP from the headers the hosting platform controls.
 *
 * Vercel overwrites `x-forwarded-for`, `x-vercel-forwarded-for`, and
 * `x-real-ip` with the public client IP and drops externally supplied values,
 * so only those are trustworthy. `x-vercel-forwarded-for` is preferred because
 * `x-forwarded-for` can be rewritten by a proxy sitting in front of Vercel.
 *
 * `cf-connecting-ip` is deliberately absent: Vercel does not set it, so a
 * caller can send an arbitrary value and mint a fresh rate-limit bucket — or
 * a forged reconciliation IP — on every request.
 */
export function getRequestIpAddress(requestHeaders: Headers): string {
  const candidates = [
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0],
    requestHeaders.get("x-forwarded-for")?.split(",")[0],
    requestHeaders.get("x-real-ip"),
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIP(value)) return value;
  }
  return "127.0.0.1";
}
