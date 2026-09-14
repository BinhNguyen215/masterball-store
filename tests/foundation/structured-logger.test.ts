import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/structured-logger";

describe("structured logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive fields while retaining operational context", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.info("payment.received", {
      orderId: "order_123",
      email: "buyer@example.com",
      nested: { authorization: "Bearer secret" },
    });

    const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(entry.orderId).toBe("order_123");
    expect(entry.email).toBe("[REDACTED]");
    expect(entry.nested).toEqual({ authorization: "[REDACTED]" });
  });
});
