import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getDb } from "@/db";
import { accounts, rateLimits, sessions, users, verifications } from "@/db/schema";

const DAY_SECONDS = 60 * 60 * 24;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createAuth(options: {
  baseURL: string;
  secret: string;
  bootstrap?: boolean;
}) {
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
    appName: "MasterBall Store Admin",
    baseURL,
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
      disableSignUp: !options.bootstrap,
      autoSignIn: false,
      minPasswordLength: 14,
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
          defaultValue: options.bootstrap ? "OWNER" : "ORDER_STAFF",
          input: false,
        },
      },
    },
    session: {
      expiresIn: DAY_SECONDS,
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
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60 * 10, max: 3 },
      },
    },
    advanced: {
      useSecureCookies,
      cookiePrefix: "masterball-admin",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies,
        path: "/",
        priority: "high",
      },
    },
  });
}
