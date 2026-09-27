import { z } from "zod";

import { FULFILLMENT_CHOICES } from "./fulfillment-choice";

export const checkoutContactSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 .-]{7,19}$/),
  email: z.string().trim().email().max(320).optional(),
});

export const checkoutAddressSchema = checkoutContactSchema.extend({
  line1: z.string().trim().min(3).max(250),
  line2: z.string().trim().max(250).optional(),
  ward: z.string().trim().max(120).optional(),
  district: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
});

/**
 * A pickup order only needs someone to hand the parcel to, so the street
 * address is not collected; the shop address comes from the deployment
 * environment (`readPickupLocation`), never from the browser.
 */
export const checkoutPickupAddressSchema = checkoutContactSchema;

const checkoutOrderBaseShape = {
  idempotencyKey: z.string().trim().min(16).max(128),
  cartToken: z.string().min(20).max(500),
  cartVersion: z.number().int().positive(),
  paymentMethod: z.enum(["COD", "VNPAY", "BANK_TRANSFER"]),
  couponCode: z.string().trim().min(1).max(32).optional(),
  customerNote: z.string().trim().max(1000).optional(),
};

export const checkoutInputSchema = z.discriminatedUnion("fulfillment", [
  z.object({
    ...checkoutOrderBaseShape,
    fulfillment: z.literal("DELIVERY"),
    address: checkoutAddressSchema,
  }),
  z.object({
    ...checkoutOrderBaseShape,
    fulfillment: z.literal("PICKUP"),
    address: checkoutPickupAddressSchema,
  }),
]);

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;
export type CheckoutPickupAddress = z.infer<typeof checkoutPickupAddressSchema>;
export type CheckoutPaymentMethod = CheckoutInput["paymentMethod"];
export type CheckoutFulfillment = (typeof FULFILLMENT_CHOICES)[number];
