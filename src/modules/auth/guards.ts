import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { hasCapability, isAdminRole, type AdminRole, type Capability } from "./roles";

export type AdminActor = {
  id: string;
  name: string;
  role: AdminRole;
};

export class AuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? "Authentication required" : "Insufficient capability");
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export async function getAdminActor(requestHeaders?: Headers): Promise<AdminActor | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }
  const session = await getAuth().api.getSession({
    headers: requestHeaders ?? (await headers()),
  });

  if (!session || !isAdminRole(session.user.role)) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function authorize(
  capability?: Capability,
  requestHeaders?: Headers,
): Promise<AdminActor> {
  const actor = await getAdminActor(requestHeaders);
  if (!actor) {
    throw new AuthorizationError(401);
  }
  if (capability && !hasCapability(actor.role, capability)) {
    throw new AuthorizationError(403);
  }
  return actor;
}

export async function requireAdminPage(capability?: Capability): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor) {
    redirect("/admin/login");
  }
  if (capability && !hasCapability(actor.role, capability)) {
    redirect("/admin/forbidden");
  }
  return actor;
}

export function authorizationResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }
  return Response.json(
    { error: error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN" },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}
