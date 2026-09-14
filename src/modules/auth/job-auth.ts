import "server-only";

import { timingSafeEqual } from "node:crypto";
import { getJobsEnvironment } from "@/config/environment";

function constantTimeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeJob(request: Request): Response | null {
  let expected: string;
  try {
    expected = getJobsEnvironment().CRON_SECRET;
  } catch {
    return Response.json(
      { error: "JOB_CONFIGURATION_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const authorization = request.headers.get("authorization") ?? "";
  const actual = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!constantTimeEqual(actual, expected)) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}
