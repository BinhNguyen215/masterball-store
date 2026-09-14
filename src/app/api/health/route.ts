import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { logger } from "@/lib/structured-logger";
import { getRequestId, requestIdHeader } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    await getDb().execute(sql`select 1`);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store", [requestIdHeader]: requestId } },
    );
  } catch (error) {
    logger.error("health.database_unavailable", { requestId, error });
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store", [requestIdHeader]: requestId } },
    );
  }
}
