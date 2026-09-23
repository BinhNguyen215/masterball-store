import { createHash } from "node:crypto";

import { z } from "zod";

import { getStorefrontCopy, type StorefrontLocale } from "@/i18n";
import { checkoutAddressSchema } from "@/modules/checkout";

const checkoutFormSchema = z.object({
  acceptTerms: z.preprocess((value) => value === "on", z.literal(true)),
  address: checkoutAddressSchema,
  cartVersion: z.coerce.number().int().positive(),
  customerNote: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(["COD", "VNPAY"]),
});

function optionalFormText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function parseCheckoutForm(formData: FormData) {
  return checkoutFormSchema.parse({
    acceptTerms: formData.get("acceptTerms"),
    address: {
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
    customerNote: optionalFormText(formData.get("customerNote")),
    paymentMethod: formData.get("paymentMethod"),
  });
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
  const messages: Record<string, string> = getStorefrontCopy(locale).checkout.checkout.errors;

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}
