import { adminApplication, IntegrationUnavailableError } from "@/modules/auth/admin-application";
import { authorize, authorizationResponse } from "@/modules/auth/guards";
import { importQuerySchema } from "@/modules/auth/schemas";

export const runtime = "nodejs";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
    const actor = await authorize("catalog.import", request.headers);
    const contentType = request.headers.get("content-type")?.split(";", 1)[0];
    if (contentType !== "text/csv" && contentType !== "application/csv") {
      return Response.json({ error: "CSV_CONTENT_TYPE_REQUIRED" }, { status: 415 });
    }
    const advertisedLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(advertisedLength) && advertisedLength > MAX_CSV_BYTES) {
      return Response.json({ error: "CSV_TOO_LARGE" }, { status: 413 });
    }

    const csv = await request.text();
    if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
      return Response.json({ error: "CSV_TOO_LARGE" }, { status: 413 });
    }
    const query = importQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const result = await adminApplication.importProductsCsv({
      csv,
      dryRun: query.dryRun,
      actorId: actor.id,
    });

    const valid = result.valid;
    return Response.json(
      { dryRun: query.dryRun, result },
      { status: valid ? (query.dryRun ? 200 : 201) : 422, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const denied = authorizationResponse(error);
    if (denied) return denied;
    if (error instanceof IntegrationUnavailableError) {
      return Response.json({ error: "IMPORT_UNAVAILABLE" }, { status: 503 });
    }
    return Response.json({ error: "INVALID_IMPORT" }, { status: 400 });
  }
}
