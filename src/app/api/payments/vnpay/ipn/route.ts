import { logger } from "@/lib/structured-logger";
import { getRequestId, requestIdHeader } from "@/lib/request-context";
import { adminApplication, IntegrationUnavailableError } from "@/modules/auth/admin-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_MESSAGES: Record<string, string> = {
  "00": "Confirm Success",
  "01": "Order not found",
  "02": "Order already confirmed",
  "04": "Invalid amount",
  "97": "Invalid signature",
  "99": "Unknown error",
};

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const result = await adminApplication.processVnpayIpn(new URL(request.url).searchParams);
    const rspCode = Object.hasOwn(RESPONSE_MESSAGES, result.rspCode) ? result.rspCode : "99";
    logger.info("payment.vnpay_ipn_processed", { requestId, rspCode });
    return Response.json(
      { RspCode: rspCode, Message: RESPONSE_MESSAGES[rspCode] },
      { headers: { "Cache-Control": "no-store", [requestIdHeader]: requestId } },
    );
  } catch (error) {
    const unavailable = error instanceof IntegrationUnavailableError;
    logger.error("payment.vnpay_ipn_failed", { requestId, unavailable, error });
    return Response.json(
      { RspCode: "99", Message: RESPONSE_MESSAGES["99"] },
      { status: unavailable ? 503 : 200, headers: { "Cache-Control": "no-store", [requestIdHeader]: requestId } },
    );
  }
}
