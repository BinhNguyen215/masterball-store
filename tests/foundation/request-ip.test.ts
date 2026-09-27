import { describe, expect, it } from "vitest";

import { getRequestIpAddress } from "@/lib/request-ip";

describe("client IP resolution", () => {
  it("ignores a client-supplied cf-connecting-ip header", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7" });

    expect(getRequestIpAddress(headers)).toBe("127.0.0.1");
  });

  it("prefers the Vercel-determined forwarded address over the other headers", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "198.51.100.9",
      "x-forwarded-for": "203.0.113.7, 198.51.100.9",
      "x-real-ip": "192.0.2.4",
    });

    expect(getRequestIpAddress(headers)).toBe("198.51.100.9");
  });

  it("takes the first hop of x-forwarded-for when the Vercel header is absent", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

    expect(getRequestIpAddress(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then to loopback", () => {
    expect(getRequestIpAddress(new Headers({ "x-real-ip": "192.0.2.4" }))).toBe("192.0.2.4");
    expect(getRequestIpAddress(new Headers())).toBe("127.0.0.1");
  });

  it("skips malformed candidates instead of trusting them", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "not-an-ip",
      "x-real-ip": "192.0.2.4",
    });

    expect(getRequestIpAddress(headers)).toBe("192.0.2.4");
  });
});
