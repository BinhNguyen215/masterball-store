import "server-only";

import { z } from "zod";

const url = z.url();
const requiredText = z.string().trim().min(1);
const strongSecret = z.string().min(32);

const applicationSchema = z.object({
  APP_URL: url,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const databaseSchema = z.object({
  DATABASE_URL: url.refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "DATABASE_URL must use postgres:// or postgresql://",
  ),
});

const authSchema = z.object({
  BETTER_AUTH_SECRET: strongSecret,
  BETTER_AUTH_URL: url,
});

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

const paymentUrl = url.refine(
  (value) =>
    process.env.NODE_ENV !== "production" ||
    value.startsWith("https://") ||
    isLoopbackHttpUrl(value),
  "Payment URLs must use HTTPS in production",
);

const paymentSchema = z.object({
  VNPAY_TMN_CODE: requiredText,
  VNPAY_HASH_SECRET: requiredText,
  VNPAY_PAYMENT_URL: paymentUrl,
  VNPAY_RETURN_URL: paymentUrl,
  VNPAY_API_URL: paymentUrl,
});

const storageSchema = z.object({
  S3_ENDPOINT: url,
  S3_REGION: requiredText,
  S3_BUCKET: requiredText,
  S3_ACCESS_KEY_ID: requiredText,
  S3_SECRET_ACCESS_KEY: requiredText,
  S3_PUBLIC_BASE_URL: url,
});

const emailSchema = z.object({
  SMTP_HOST: requiredText,
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
  SMTP_USER: requiredText,
  SMTP_PASSWORD: requiredText,
  EMAIL_FROM: requiredText,
});

const jobsSchema = z.object({
  CRON_SECRET: strongSecret,
});

function parseEnvironment<T extends z.ZodType>(
  name: string,
  schema: T,
): z.output<T> {
  const result = schema.safeParse(process.env);

  if (result.success) {
    return result.data;
  }

  const fields = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter(Boolean)
    .join(", ");
  throw new Error(`Invalid ${name} environment configuration: ${fields}`);
}

export const getApplicationEnvironment = () =>
  parseEnvironment("application", applicationSchema);

export const getDatabaseEnvironment = () =>
  parseEnvironment("database", databaseSchema);

export const getAuthEnvironment = () => parseEnvironment("auth", authSchema);

export const getPaymentEnvironment = () =>
  parseEnvironment("payment", paymentSchema);

export const getStorageEnvironment = () =>
  parseEnvironment("storage", storageSchema);

export const getEmailEnvironment = () => parseEnvironment("email", emailSchema);

export const getJobsEnvironment = () => parseEnvironment("jobs", jobsSchema);
