import { z } from "zod";

import type { StorefrontCopy } from "@/i18n";

const addToCartSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99),
  variantId: z.string().uuid(),
});

export class ProductCartFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductCartFormError";
  }
}

export function parseAddToCartForm(formData: FormData) {
  return addToCartSchema.parse({
    quantity: formData.get("quantity"),
    variantId: formData.get("variantId"),
  });
}

export function getAddedCartQuantity(current: number, added: number): number {
  const quantity = current + added;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new ProductCartFormError("Cart quantity must be between 1 and 99.");
  }
  return quantity;
}

export function getProductCartMessage(
  input: {
    cart?: string | string[];
    error?: string | string[];
  },
  copy: StorefrontCopy["product"],
): { kind: "error" | "success"; text: string } | undefined {
  if (input.cart === "added") {
    return { kind: "success", text: copy.cartAdded };
  }

  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  const messages: Record<string, string> = {
    changed: copy.cartErrorChanged,
    invalid: copy.cartErrorInvalid,
    service: copy.cartErrorService,
    stock: copy.cartErrorStock,
    unavailable: copy.cartErrorUnavailable,
  };

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}
