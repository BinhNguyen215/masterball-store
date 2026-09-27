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
    throttled: copy.cartErrorThrottled,
    unavailable: copy.cartErrorUnavailable,
  };

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}

/** One localized notice the product page shows for a guest submission. */
export type ProductNotice = {
  kind: "error" | "success";
  text: string;
};

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Reads the five fields the review form posts. Ranges are not re-checked here:
 * the review service validates them and answers a typed failure, so the page
 * only has to translate the outcome into a notice.
 */
export function readProductReviewForm(formData: FormData) {
  return {
    authorName: readFormString(formData, "authorName"),
    body: readFormString(formData, "body"),
    orderNumber: readFormString(formData, "orderNumber"),
    phone: readFormString(formData, "phone"),
    rating: Number(readFormString(formData, "rating")),
  };
}

/** Reads the two fields the restock form posts; the alert service validates both. */
export function readRestockAlertForm(formData: FormData) {
  return {
    email: readFormString(formData, "email"),
    variantId: readFormString(formData, "variantId"),
  };
}

/**
 * Turns the review query the server action redirects with into the one notice
 * the section shows. A code the action never emits (a hand-edited URL) renders
 * no notice at all rather than an empty one.
 */
export function getProductReviewMessage(
  query: { review?: string | string[] },
  copy: StorefrontCopy["reviews"],
): ProductNotice | undefined {
  const review = (Array.isArray(query.review) ? query.review[0] : query.review) ?? "";
  if (review === "recorded") {
    return { kind: "success", text: copy.pendingNotice };
  }

  const errors: Record<string, string> = {
    duplicate: copy.errors.duplicate,
    invalid: copy.errors.invalid,
    notfound: copy.errors.notFound,
    service: copy.errors.service,
    throttled: copy.errors.throttled,
  };
  const text = errors[review];
  return text ? { kind: "error", text } : undefined;
}

/**
 * Turns the restock query the server action redirects with into the one notice
 * the summary shows. A recording and an already-registered address are both
 * informational; everything else is an error.
 */
export function getRestockMessage(
  query: { restock?: string | string[] },
  copy: StorefrontCopy["restock"],
): ProductNotice | undefined {
  const restock = (Array.isArray(query.restock) ? query.restock[0] : query.restock) ?? "";
  if (restock === "recorded") {
    return { kind: "success", text: copy.successNotice };
  }
  if (restock === "existing") {
    return { kind: "success", text: copy.alreadyNotice };
  }

  const errors: Record<string, string> = {
    invalid: copy.errors.invalid,
    service: copy.errors.service,
    throttled: copy.errors.throttled,
    unavailable: copy.errors.unavailable,
  };
  const text = errors[restock];
  return text ? { kind: "error", text } : undefined;
}
