import { describe, expect, it } from "vitest";

import {
  InventoryError,
  normalizeInventoryReservationItems,
} from "@/modules/inventory";

describe("inventory reservation rules", () => {
  it("combines duplicate variants and locks them in stable identifier order", () => {
    expect(
      normalizeInventoryReservationItems([
        { variantId: "z", quantity: 1 },
        { variantId: "a", quantity: 2 },
        { variantId: "z", quantity: 3 },
      ]),
    ).toEqual([
      { variantId: "a", quantity: 2 },
      { variantId: "z", quantity: 4 },
    ]);
  });

  it("rejects zero, negative, and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(() =>
        normalizeInventoryReservationItems([{ variantId: "a", quantity }]),
      ).toThrow(InventoryError);
    }
  });
});
