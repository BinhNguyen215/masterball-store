import { getCustomerAuth } from "@/modules/auth/auth";

export const runtime = "nodejs";

/**
 * Shopper auth catch-all. Mounted on its own base path so the staff handler at
 * `/api/auth/[...all]` never sees a customer request.
 */
export function GET(request: Request) {
  return getCustomerAuth().handler(request);
}

export function POST(request: Request) {
  return getCustomerAuth().handler(request);
}
