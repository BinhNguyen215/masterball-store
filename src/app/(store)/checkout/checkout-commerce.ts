import { createHash } from "node:crypto";

import { z } from "zod";

import { getStorefrontCopy, type StorefrontCopy, type StorefrontLocale } from "@/i18n";
import {
  checkoutAddressSchema,
  checkoutPickupAddressSchema,
  type CheckoutInput,
} from "@/modules/checkout";

const checkoutFormBaseShape = {
  acceptTerms: z.preprocess((value) => value === "on", z.literal(true)),
  cartVersion: z.coerce.number().int().positive(),
  couponCode: z.string().trim().min(1).max(32).optional(),
  customerNote: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(["COD", "VNPAY", "BANK_TRANSFER"]),
};

const checkoutFormSchema = z.discriminatedUnion("fulfillment", [
  z.object({
    ...checkoutFormBaseShape,
    fulfillment: z.literal("DELIVERY"),
    address: checkoutAddressSchema,
  }),
  z.object({
    ...checkoutFormBaseShape,
    fulfillment: z.literal("PICKUP"),
    address: checkoutPickupAddressSchema,
  }),
]);

export type ParsedCheckoutForm = z.infer<typeof checkoutFormSchema>;

/** Checkout redirects carry the coupon refusal as a URL slug. */
const COUPON_ERROR_KEYS: Record<string, keyof StorefrontCopy["coupons"]["errors"]> = {
  exhausted: "exhausted",
  expired: "expired",
  inactive: "inactive",
  invalid: "invalid",
  "min-order": "minOrder",
  "not-found": "notFound",
  "not-started": "notStarted",
};

function optionalFormText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function parseCheckoutForm(formData: FormData) {
  const fulfillment = String(formData.get("fulfillment") ?? "").trim() || "DELIVERY";
  return checkoutFormSchema.parse({
    acceptTerms: formData.get("acceptTerms"),
    address:
      fulfillment === "PICKUP"
        ? {
            email: optionalFormText(formData.get("email")),
            phone: formData.get("phone"),
            recipientName: formData.get("recipientName"),
          }
        : {
            district: formData.get("district"),
            email: optionalFormText(formData.get("email")),
            line1: formData.get("line1"),
            line2: optionalFormText(formData.get("line2")),
            phone: formData.get("phone"),
            province: formData.get("province"),
            recipientName: formData.get("recipientName"),
            ward: optionalFormText(formData.get("ward")),
          },
    cartVersion: formData.get("cartVersion"),
    couponCode: optionalFormText(formData.get("couponCode")),
    customerNote: optionalFormText(formData.get("customerNote")),
    fulfillment,
    paymentMethod: formData.get("paymentMethod"),
  });
}

/**
 * The parsed form plus the server-derived identity the checkout service needs.
 * The delivery choice decides which address shape is legitimate, so the union
 * is narrowed here instead of at the call site.
 */
export function toCheckoutOrderInput(
  input: ParsedCheckoutForm,
  identity: { cartToken: string; idempotencyKey: string },
): CheckoutInput {
  const shared = {
    cartToken: identity.cartToken,
    cartVersion: input.cartVersion,
    ...(input.couponCode ? { couponCode: input.couponCode } : {}),
    ...(input.customerNote ? { customerNote: input.customerNote } : {}),
    idempotencyKey: identity.idempotencyKey,
    paymentMethod: input.paymentMethod,
  };
  return input.fulfillment === "PICKUP"
    ? { ...shared, address: input.address, fulfillment: "PICKUP" }
    : { ...shared, address: input.address, fulfillment: "DELIVERY" };
}

export function createCheckoutIdempotencyKey(
  cartToken: string,
  cartVersion: number,
): string {
  return createHash("sha256")
    .update(`storefront-checkout:${cartToken}:${cartVersion}`)
    .digest("hex");
}

export function getCheckoutPageMessage(
  input: {
    error?: string | string[];
  },
  locale: StorefrontLocale,
): { kind: "error"; text: string } | undefined {
  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  if (!error) return undefined;

  const copy = getStorefrontCopy(locale);
  if (error.startsWith("coupon-")) {
    const reason = COUPON_ERROR_KEYS[error.slice("coupon-".length)];
    return reason ? { kind: "error", text: copy.coupons.errors[reason] } : undefined;
  }

  const messages: Record<string, string> = copy.checkout.checkout.errors;
  return messages[error] ? { kind: "error", text: messages[error] } : undefined;
}
