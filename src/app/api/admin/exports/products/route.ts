import { exportProductsCsv } from "@/modules/catalog";
import { authorize, authorizationResponse } from "@/modules/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorize("catalog.import", request.headers);
    const csv = await exportProductsCsv();

    return new Response(csv, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="masterball-products.csv"',
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const denied = authorizationResponse(error);
    if (denied) return denied;
    return Response.json(
      { error: "EXPORT_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
