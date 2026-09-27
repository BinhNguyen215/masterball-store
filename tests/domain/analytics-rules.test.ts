import { describe, expect, it } from "vitest";

import { computeRevenueTrend } from "@/modules/analytics";

describe("analytics revenue trend", () => {
  it("reports growth against the previous window", () => {
    const trend = computeRevenueTrend(1_500_000, 1_000_000);
    expect(trend.direction).toBe("up");
    expect(trend.deltaVnd).toBe(500_000);
    expect(trend.deltaPercent).toBeCloseTo(50, 6);
  });

  it("reports decline against the previous window", () => {
    const trend = computeRevenueTrend(800_000, 1_000_000);
    expect(trend.direction).toBe("down");
    expect(trend.deltaVnd).toBe(-200_000);
    expect(trend.deltaPercent).toBeCloseTo(-20, 6);
  });

  it("reports a flat window when nothing changed", () => {
    expect(computeRevenueTrend(0, 0)).toEqual({
      deltaVnd: 0,
      deltaPercent: null,
      direction: "flat",
    });
  });

  it("has no ratio when the previous window collected nothing", () => {
    const trend = computeRevenueTrend(450_000, 0);
    expect(trend.direction).toBe("up");
    expect(trend.deltaVnd).toBe(450_000);
    expect(trend.deltaPercent).toBeNull();
  });
});
