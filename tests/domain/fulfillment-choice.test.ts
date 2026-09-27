import { describe, expect, it } from "vitest";

import {
  encodeOrderNote,
  PICKUP_NOTE_TAG,
  readFulfillmentChoice,
} from "@/modules/checkout/fulfillment-choice";
import {
  getCheckoutShippingFee,
  HO_CHI_MINH_SHIPPING_VND,
  OTHER_PROVINCE_SHIPPING_VND,
  PICKUP_SHIPPING_VND,
} from "@/modules/checkout/shipping-fee";

describe("store pickup as a delivery choice", () => {
  it("tags the note and keeps the customer's own words", () => {
    expect(encodeOrderNote("PICKUP", "Gọi trước khi tới")).toBe(
      `${PICKUP_NOTE_TAG} Gọi trước khi tới`,
    );
    expect(encodeOrderNote("PICKUP")).toBe(PICKUP_NOTE_TAG);
    expect(encodeOrderNote("PICKUP", "   ")).toBe(PICKUP_NOTE_TAG);
  });

  it("stores a delivery note verbatim and never invents one", () => {
    expect(encodeOrderNote("DELIVERY", "Giao giờ hành chính")).toBe(
      "Giao giờ hành chính",
    );
    expect(encodeOrderNote("DELIVERY", "  ")).toBeNull();
    expect(encodeOrderNote("DELIVERY")).toBeNull();
  });

  it("reads the choice back out of the persisted note", () => {
    expect(readFulfillmentChoice({ customerNote: encodeOrderNote("PICKUP", "abc") })).toBe(
      "PICKUP",
    );
    expect(readFulfillmentChoice({ customerNote: `${PICKUP_NOTE_TAG}` })).toBe("PICKUP");
    expect(readFulfillmentChoice({ customerNote: "Giao buổi sáng" })).toBe("DELIVERY");
    expect(readFulfillmentChoice({ customerNote: null })).toBe("DELIVERY");
    expect(readFulfillmentChoice({})).toBe("DELIVERY");
  });

  it("does not mistake a note that merely mentions pickup for the choice", () => {
    expect(readFulfillmentChoice({ customerNote: "tôi sẽ nhận tại cửa hàng" })).toBe(
      "DELIVERY",
    );
  });

  it("charges nothing for pickup and keeps the regional fee for delivery", () => {
    expect(
      getCheckoutShippingFee({ fulfillment: "PICKUP", province: "Đà Nẵng" }),
    ).toBe(PICKUP_SHIPPING_VND);
    expect(PICKUP_SHIPPING_VND).toBe(0);
    expect(
      getCheckoutShippingFee({ fulfillment: "DELIVERY", province: "TP. Hồ Chí Minh" }),
    ).toBe(HO_CHI_MINH_SHIPPING_VND);
    expect(
      getCheckoutShippingFee({ fulfillment: "DELIVERY", province: "Đà Nẵng" }),
    ).toBe(OTHER_PROVINCE_SHIPPING_VND);
  });
});
