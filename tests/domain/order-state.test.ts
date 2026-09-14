import { describe, expect, it } from "vitest";

import {
  canTransition,
  fulfillmentTransitions,
  orderTransitions,
  paymentTransitions,
} from "@/modules/orders";

describe("order state machines", () => {
  it("allows the intended forward order and fulfillment paths", () => {
    expect(canTransition(orderTransitions, "PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition(orderTransitions, "CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransition(fulfillmentTransitions, "PROCESSING", "SHIPPED")).toBe(true);
  });

  it("rejects reopening terminal states and arbitrary payment transitions", () => {
    expect(canTransition(orderTransitions, "CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition(fulfillmentTransitions, "RETURNED", "SHIPPED")).toBe(false);
    expect(canTransition(paymentTransitions, "REFUNDED", "PAID")).toBe(false);
  });

  it("supports manual review for a delayed verified payment", () => {
    expect(canTransition(paymentTransitions, "PENDING", "MANUAL_REVIEW")).toBe(true);
    expect(canTransition(paymentTransitions, "FAILED", "MANUAL_REVIEW")).toBe(true);
  });
});
