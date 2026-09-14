import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  hasCapability,
  ROLE_CAPABILITIES,
} from "@/modules/auth/roles";

describe("admin role capabilities", () => {
  it("keeps catalog managers out of order and settings mutations", () => {
    expect(hasCapability("CATALOG_MANAGER", "catalog.write")).toBe(true);
    expect(hasCapability("CATALOG_MANAGER", "inventory.adjust")).toBe(true);
    expect(hasCapability("CATALOG_MANAGER", "orders.transition")).toBe(false);
    expect(hasCapability("CATALOG_MANAGER", "settings.write")).toBe(false);
  });

  it("limits order staff to operational order, payment and inventory reads", () => {
    expect(hasCapability("ORDER_STAFF", "orders.transition")).toBe(true);
    expect(hasCapability("ORDER_STAFF", "payments.reconcile")).toBe(true);
    expect(hasCapability("ORDER_STAFF", "catalog.write")).toBe(false);
    expect(hasCapability("ORDER_STAFF", "inventory.adjust")).toBe(false);
  });

  it("limits event editors to tournament content and audit visibility", () => {
    expect(hasCapability("EVENT_EDITOR", "tournaments.write")).toBe(true);
    expect(hasCapability("EVENT_EDITOR", "tournaments.publish")).toBe(true);
    expect(hasCapability("EVENT_EDITOR", "orders.read")).toBe(false);
    expect(hasCapability("EVENT_EDITOR", "catalog.read")).toBe(false);
  });

  it("grants the owner every declared capability", () => {
    expect(ROLE_CAPABILITIES.OWNER).toEqual(new Set(CAPABILITIES));
  });
});
