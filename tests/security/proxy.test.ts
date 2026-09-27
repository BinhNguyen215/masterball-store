import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { config, proxy } from "@/proxy";

const ORIGIN = "http://localhost:3100";

describe("request proxy", () => {
  it("redirects an unauthenticated admin request to the login page", () => {
    const response = proxy(new NextRequest(new URL("/admin/orders", ORIGIN)));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/login`);
  });

  it("passes the login page through with the security headers", () => {
    const response = proxy(new NextRequest(new URL("/admin/login", ORIGIN)));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("passes an authenticated admin request through", () => {
    const response = proxy(
      new NextRequest(new URL("/admin/orders", ORIGIN), {
        headers: { cookie: "masterball-admin.session_token=session" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("does not match API routes, whose bodies must not be buffered", () => {
    expect(config.matcher.some((pattern) => pattern.startsWith("/api"))).toBe(false);
  });
});
