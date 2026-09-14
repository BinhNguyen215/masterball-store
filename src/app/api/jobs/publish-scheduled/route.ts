import { adminApplication, IntegrationUnavailableError } from "@/modules/auth/admin-application";
import { authorizeJob } from "@/modules/auth/job-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = authorizeJob(request);
  if (denied) return denied;
  try {
    const result = await adminApplication.publishScheduled(new Date());
    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof IntegrationUnavailableError ? "JOB_UNAVAILABLE" : "JOB_FAILED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
