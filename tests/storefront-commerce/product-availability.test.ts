import { describe, expect, it } from "vitest";

import {
  LOW_STOCK_THRESHOLD,
  summarizeAvailability,
} from "@/components/storefront/product-availability";

describe("product availability summary", () => {
  it("adds up the sellable units across every active variant", () => {
    expect(
      summarizeAvailability([{ available: 2 }, { available: 5 }, { available: 0 }]),
    ).toEqual({ available: true, availableUnits: 7, lowStock: false });
  });

  it("flags low stock once the remaining units reach the threshold", () => {
    expect(summarizeAvailability([{ available: LOW_STOCK_THRESHOLD }]).lowStock).toBe(true);
    expect(summarizeAvailability([{ available: LOW_STOCK_THRESHOLD + 1 }]).lowStock).toBe(false);
  });

  it("treats a product with no sellable unit as out of stock, not low stock", () => {
    expect(summarizeAvailability([{ available: 0 }, { available: 0 }])).toEqual({
      available: false,
      availableUnits: 0,
      lowStock: false,
    });
    expect(summarizeAvailability([])).toEqual({
      available: false,
      availableUnits: 0,
      lowStock: false,
    });
  });

  it("ignores an oversold variant instead of subtracting from the total", () => {
    expect(summarizeAvailability([{ available: 4 }, { available: -2 }])).toEqual({
      available: true,
      availableUnits: 4,
      lowStock: false,
    });
  });
});
