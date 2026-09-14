import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb } from "@/db";
import { createAuth } from "@/modules/auth/auth-factory";

describe("admin auth bootstrap contract", () => {
  beforeEach(() => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres:postgres@127.0.0.1:5432/masterball_auth_test",
    );
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await closeDb();
  });

  it("assigns OWNER on the server without accepting role input", () => {
    const auth = createAuth({
      baseURL: "http://127.0.0.1:3100",
      bootstrap: true,
      secret: "test-only-secret-with-at-least-thirty-two-characters",
    });

    expect(auth.options.user?.additionalFields?.role).toMatchObject({
      defaultValue: "OWNER",
      input: false,
      required: true,
    });
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(false);
  });

  it("keeps public staff registration disabled", () => {
    const auth = createAuth({
      baseURL: "http://127.0.0.1:3100",
      secret: "test-only-secret-with-at-least-thirty-two-characters",
    });

    expect(auth.options.user?.additionalFields?.role).toMatchObject({
      defaultValue: "ORDER_STAFF",
      input: false,
    });
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("allows HTTP loopback for production E2E without secure cookies", () => {
    vi.stubEnv("NODE_ENV", "production");

    const auth = createAuth({
      baseURL: "http://127.0.0.1:3100",
      secret: "test-only-secret-with-at-least-thirty-two-characters",
    });

    expect(auth.options.advanced?.useSecureCookies).toBe(false);
    expect(auth.options.advanced?.defaultCookieAttributes?.secure).toBe(false);
  });

  it("requires HTTPS for non-loopback production origins", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      createAuth({
        baseURL: "http://store.example.com",
        secret: "test-only-secret-with-at-least-thirty-two-characters",
      }),
    ).toThrow("BETTER_AUTH_URL must use HTTPS in production.");
  });
});
