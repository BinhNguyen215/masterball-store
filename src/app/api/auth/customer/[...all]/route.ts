import { getRequestIpAddress } from "@/lib/request-ip";
import { getCustomerAuth } from "@/modules/auth/auth";
import { consumeGuestRateLimit } from "@/modules/orders";

export const runtime = "nodejs";

/** The two paths that check a credential and therefore need the shared bucket. */
const CREDENTIAL_PATHS = ["/sign-in/email", "/sign-up/email"];

/**
 * The shared customer-auth bucket, enforced on the only path that cannot be
 * skipped. The account forms also call `allowCustomerAuth()` first, but that is
 * a server action the browser may simply not call — a client can POST straight
 * to this handler, so the credential check has to spend the budget itself.
 */
async function throttleCredentials(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(
    "/api/auth/customer",
    "",
  );
  if (!CREDENTIAL_PATHS.includes(path)) return null;

  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(request.headers),
    scope: "customer-auth",
  });
  if (allowed) return null;

  return Response.json(
    { message: "Too many attempts. Please try again later." },
    { status: 429, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Shopper auth catch-all. Mounted on its own base path so the staff handler at
 * `/api/auth/[...all]` never sees a customer request.
 */
export async function GET(request: Request) {
  return getCustomerAuth().handler(request);
}

export async function POST(request: Request) {
  const throttled = await throttleCredentials(request);
  if (throttled) return throttled;
  return getCustomerAuth().handler(request);
}
