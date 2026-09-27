import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { closeDb } from "@/db";
import { createAuth, resolveAuthAudience } from "@/modules/auth/auth-factory";
import { ADMIN_ROLES, CUSTOMER_ROLE, isAdminRole, isCustomerRole } from "@/modules/auth/roles";
import { proxy } from "@/proxy";

const SECRET = "test-only-secret-with-at-least-thirty-two-characters";
const ORIGIN = "http://localhost:3100";

describe("customer role separation", () => {
  it("keeps the CUSTOMER role out of the staff role list", () => {
    expect(CUSTOMER_ROLE).toBe("CUSTOMER");
    expect(ADMIN_ROLES).not.toContain(CUSTOMER_ROLE);
    expect(isAdminRole("CUSTOMER")).toBe(false);
    expect(isCustomerRole("CUSTOMER")).toBe(true);
    for (const staffRole of ADMIN_ROLES) {
      expect(isCustomerRole(staffRole)).toBe(false);
    }
  });

  it("resolves an audience profile that cannot mint staff", () => {
    const customer = resolveAuthAudience("customer");
    expect(customer).toMatchObject({
      basePath: "/api/auth/customer",
      cookiePrefix: "masterball-customer",
      disableSignUp: false,
      minPasswordLength: 8,
      roleDefault: CUSTOMER_ROLE,
    });
    expect(customer.roleDefault).toBe("CUSTOMER");
  });

  it("keeps the staff defaults the admin console depends on", () => {
    expect(resolveAuthAudience("staff")).toMatchObject({
      appName: "MasterBall Store Admin",
      basePath: "/api/auth",
      cookiePrefix: "masterball-admin",
      disableSignUp: true,
      roleDefault: "ORDER_STAFF",
    });
    expect(resolveAuthAudience("staff", true)).toMatchObject({
      disableSignUp: false,
      roleDefault: "OWNER",
    });
  });
});

describe("customer auth instance", () => {
  beforeEach(() => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres:postgres@127.0.0.1:5432/masterball_customer_test",
    );
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await closeDb();
  });

  it("assigns CUSTOMER on the server without accepting role input", () => {
    const auth = createAuth({ audience: "customer", baseURL: ORIGIN, secret: SECRET });

    expect(auth.options.user?.additionalFields?.role).toMatchObject({
      defaultValue: "CUSTOMER",
      input: false,
      required: true,
    });
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(false);
    expect(auth.options.emailAndPassword?.autoSignIn).toBe(true);
    expect(auth.options.advanced?.cookiePrefix).toBe("masterball-customer");
    expect(auth.options.basePath).toBe("/api/auth/customer");
  });

  it("does not accept the customer cookie as a staff session", () => {
    const request = new NextRequest(new URL("/admin/orders", ORIGIN), {
      headers: { cookie: "masterball-customer.session_token=shopper" },
    });

    expect(proxy(request).status).toBe(307);
    expect(proxy(request).headers.get("location")).toBe(`${ORIGIN}/admin/login`);
  });
});
