import { z } from "zod";

import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { CartLineItemViewModel } from "@/components/storefront/storefront-types";
import {
  formatCopy,
  getStorefrontCopy,
  type StorefrontCopy,
  type StorefrontLocale,
} from "@/i18n";

const cartMutationSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  variantId: z.string().uuid(),
});

const updateCartMutationSchema = cartMutationSchema.extend({
  quantity: z.coerce.number().int().min(1).max(99),
});

export function parseUpdateCartForm(formData: FormData) {
  return updateCartMutationSchema.parse({
    expectedVersion: formData.get("expectedVersion"),
    quantity: formData.get("quantity"),
    variantId: formData.get("variantId"),
  });
}

export function parseRemoveCartForm(formData: FormData) {
  return cartMutationSchema.parse({
    expectedVersion: formData.get("expectedVersion"),
    variantId: formData.get("variantId"),
  });
}

export type CartSnapshot = {
  version: number;
  status: string;
  expiresAt: Date;
  subtotalVnd: number;
  items: Array<{
    variantId: string;
    productTitle: string;
    productSlug: string;
    sku: string;
    quantity: number;
    priceAtAddVnd: number;
    currentPriceVnd: number;
    available: number;
    priceChanged: boolean;
    stockChanged: boolean;
  }>;
};

function getCartWarning(
  item: CartSnapshot["items"][number],
  copy: StorefrontCopy["checkout"]["cart"],
  locale: StorefrontLocale,
): string | undefined {
  const warnings: string[] = [];

  if (item.priceChanged) {
    warnings.push(
      formatCopy(copy.warningPriceChanged, {
        from: formatVnd(item.priceAtAddVnd, locale),
        to: formatVnd(item.currentPriceVnd, locale),
      }),
    );
  }
  if (item.stockChanged) {
    warnings.push(
      item.available > 0
        ? formatCopy(copy.warningStockLeft, { count: item.available })
        : copy.warningSoldOut,
    );
  }

  return warnings.length ? warnings.join(" ") : undefined;
}

export function mapCartItems(
  snapshot: CartSnapshot,
  locale: StorefrontLocale,
): CartLineItemViewModel[] {
  const copy = getStorefrontCopy(locale).checkout.cart;

  return snapshot.items.map((item) => ({
    lineId: item.variantId,
    productName: item.productTitle,
    productSlug: item.productSlug,
    quantity: item.quantity,
    unitPriceVnd: item.currentPriceVnd,
    variantId: item.variantId,
    variantLabel: item.sku,
    warning: getCartWarning(item, copy, locale),
  }));
}

export function isActiveCart(snapshot: CartSnapshot): boolean {
  return snapshot.status === "ACTIVE" && snapshot.expiresAt > new Date();
}

export function isCheckoutReady(snapshot: CartSnapshot): boolean {
  return (
    isActiveCart(snapshot) &&
    snapshot.items.length > 0 &&
    snapshot.items.every((item) => !item.stockChanged)
  );
}

export function getCartPageMessage(
  input: {
    error?: string | string[];
    status?: string | string[];
  },
  locale: StorefrontLocale,
): { kind: "error" | "success"; text: string } | undefined {
  const copy = getStorefrontCopy(locale).checkout.cart;
  const status = Array.isArray(input.status) ? input.status[0] : input.status;
  if (status === "updated") {
    return { kind: "success", text: copy.messageUpdated };
  }
  if (status === "removed") {
    return { kind: "success", text: copy.messageRemoved };
  }

  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  const messages: Record<string, string> = copy.errors;

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}
