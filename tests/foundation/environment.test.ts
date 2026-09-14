import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDatabaseEnvironment,
  getPaymentEnvironment,
} from "@/config/environment";

describe("environment validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a PostgreSQL database URL", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/store");

    expect(getDatabaseEnvironment().DATABASE_URL).toContain("/store");
  });

  it("reports invalid fields without echoing their values", () => {
    vi.stubEnv("DATABASE_URL", "not-a-url-with-super-secret-value");

    expect(() => getDatabaseEnvironment()).toThrowError(
      "Invalid database environment configuration: DATABASE_URL",
    );
  });

  it("parses a complete VNPAY configuration", () => {
    vi.stubEnv("VNPAY_TMN_CODE", "TESTCODE");
    vi.stubEnv("VNPAY_HASH_SECRET", "hash-secret");
    vi.stubEnv(
      "VNPAY_PAYMENT_URL",
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    );
    vi.stubEnv("VNPAY_RETURN_URL", "http://localhost:3100/api/payments/vnpay/return");
    vi.stubEnv(
      "VNPAY_API_URL",
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    );

    expect(getPaymentEnvironment().VNPAY_TMN_CODE).toBe("TESTCODE");
  });
});
