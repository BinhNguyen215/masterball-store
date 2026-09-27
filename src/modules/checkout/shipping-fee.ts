import type { FulfillmentChoice } from "./fulfillment-choice";

/**
 * Server-owned shipping rule for domestic delivery, shared with the checkout UI
 * so the amount a customer sees is the amount the server charges. Pure and
 * dependency-free: it is imported by client components and by the checkout
 * service through the same entry point.
 */
const HO_CHI_MINH_PROVINCE_FORMS: Record<string, true> = {
  hcm: true,
  hcmc: true,
  hochiminh: true,
  saigon: true,
  tphcm: true,
  tphochiminh: true,
  thanhphohochiminh: true,
};

export const HO_CHI_MINH_SHIPPING_VND = 30_000;
export const OTHER_PROVINCE_SHIPPING_VND = 40_000;

/** Collecting at the shop never carries a delivery charge. */
export const PICKUP_SHIPPING_VND = 0;

/**
 * The fee the storefront quotes and the checkout service charges, for both
 * delivery choices. A pickup order ignores the province entirely.
 */
export function getCheckoutShippingFee(input: {
  fulfillment: FulfillmentChoice;
  province: string;
}): number {
  return input.fulfillment === "PICKUP"
    ? PICKUP_SHIPPING_VND
    : getVietnamShippingFee({ province: input.province });
}

export function normalizeVietnamesePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

export function getVietnamShippingFee(address: { province: string }): number {
  return isHoChiMinhAddress(address.province)
    ? HO_CHI_MINH_SHIPPING_VND
    : OTHER_PROVINCE_SHIPPING_VND;
}

function isHoChiMinhAddress(province: string): boolean {
  return HO_CHI_MINH_PROVINCE_FORMS[normalizeVietnamesePlace(province)] === true;
}
