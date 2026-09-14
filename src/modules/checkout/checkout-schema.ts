import { z } from "zod";

export const checkoutAddressSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 .-]{7,19}$/),
  email: z.string().trim().email().max(320).optional(),
  line1: z.string().trim().min(3).max(250),
  line2: z.string().trim().max(250).optional(),
  ward: z.string().trim().max(120).optional(),
  district: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
});

export const checkoutInputSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(128),
  cartToken: z.string().min(20).max(500),
  cartVersion: z.number().int().positive(),
  paymentMethod: z.enum(["COD", "VNPAY"]),
  address: checkoutAddressSchema,
  customerNote: z.string().trim().max(1000).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;
