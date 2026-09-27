import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getDb } from "@/db";
import { accounts, rateLimits, sessions, users, verifications } from "@/db/schema";

import { CUSTOMER_ROLE } from "./roles";

const DAY_SECONDS = 60 * 60 * 24;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The object every caller of `createAuth` receives, whatever the audience. */
export type AuthInstance = ReturnType<typeof createAuth>;

/** The two populations that share the auth tables but never the same session. */
export type AuthAudience = "staff" | "customer";

type RateLimitRule = { window: number; max: number };

type AuthAudienceProfile = {
  appName: string;
  basePath: string;
  cookiePrefix: string;
  disableSignUp: boolean;
  autoSignIn: boolean;
  minPasswordLength: number;
  roleDefault: string;
  sessionExpiresIn: number;
  customRules: Record<string, RateLimitRule>;
};

/**
 * Every value that differs between the staff console and the shopper accounts.
 * `"staff"` reproduces the historical defaults byte for byte, so the admin
 * contract tests keep pinning the same literals.
 */
export function resolveAuthAudience(
  audience: AuthAudience,
  bootstrap = false,
): AuthAudienceProfile {
  if (audience === "customer") {
    return {
      appName: "MasterBall Store",
      basePath: "/api/auth/customer",
      cookiePrefix: "masterball-customer",
      // Shoppers register themselves; staff sign-up stays closed unless the
      // owner bootstrap opens it for one run.
      disableSignUp: false,
      // Registration signs the shopper straight in, so a new account can adopt
      // the guest cart without a second round trip.
      autoSignIn: true,
      minPasswordLength: 8,
      roleDefault: CUSTOMER_ROLE,
      // A shopper expects to stay signed in on their own device.
      sessionExpiresIn: 30 * DAY_SECONDS,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 600, max: 10 },
        "/request-password-reset": { window: 600, max: 3 },
      },
    };
  }
  return {
    appName: "MasterBall Store Admin",
    basePath: "/api/auth",
    cookiePrefix: "masterball-admin",
    disableSignUp: !bootstrap,
    autoSignIn: false,
    minPasswordLength: 14,
    roleDefault: bootstrap ? "OWNER" : "ORDER_STAFF",
    sessionExpiresIn: DAY_SECONDS,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 600, max: 3 },
    },
  };
}

export function createAuth(options: {
  baseURL: string;
  secret: string;
  bootstrap?: boolean;
  /** Defaults to `"staff"` so every existing caller keeps the admin instance. */
  audience?: AuthAudience;
}) {
  const profile = resolveAuthAudience(options.audience ?? "staff", options.bootstrap ?? false);
  const parsedBaseURL = new URL(options.baseURL);
  const baseURL = parsedBaseURL.origin;
  const isProduction = process.env.NODE_ENV === "production";
  const isLoopbackHttp =
    parsedBaseURL.protocol === "http:" && LOOPBACK_HOSTS.has(parsedBaseURL.hostname);
  const useSecureCookies = isProduction && !isLoopbackHttp;

  if (isProduction && parsedBaseURL.protocol !== "https:" && !isLoopbackHttp) {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }

  return betterAuth({
    appName: profile.appName,
    baseURL,
    basePath: profile.basePath,
    secret: options.secret,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: rateLimits,
      },
      transaction: true,
    }),
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      disableSignUp: profile.disableSignUp,
      autoSignIn: profile.autoSignIn,
      minPasswordLength: profile.minPasswordLength,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: profile.roleDefault,
          input: false,
        },
      },
    },
    session: {
      expiresIn: profile.sessionExpiresIn,
      updateAge: 60 * 60,
      freshAge: 15 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      storage: "database",
      modelName: "rateLimit",
      customRules: profile.customRules,
    },
    advanced: {
      useSecureCookies,
      cookiePrefix: profile.cookiePrefix,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies,
        path: "/",
        priority: "high",
      },
      // Mirror `src/lib/request-ip.ts`: the platform-managed headers first. The
      // library refuses a multi-valued `x-forwarded-for` and then falls back to
      // ONE shared bucket per path, which would let a single client lock every
      // shopper out of sign-in.
      ipAddress: {
        ipAddressHeaders: [
          "x-vercel-forwarded-for",
          "x-forwarded-for",
          "x-real-ip",
        ],
      },
    },
  });
}
