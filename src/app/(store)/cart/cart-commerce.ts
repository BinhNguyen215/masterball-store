import { z } from "zod";

import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { CartLineItemViewModel } from "@/components/storefront/storefront-types";

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

function getCartWarning(item: CartSnapshot["items"][number]): string | undefined {
  const warnings: string[] = [];

  if (item.priceChanged) {
    warnings.push(
      `Giá đã đổi từ ${formatVnd(item.priceAtAddVnd)} thành ${formatVnd(item.currentPriceVnd)}.`,
    );
  }
  if (item.stockChanged) {
    warnings.push(
      item.available > 0
        ? `Hiện chỉ còn ${item.available} sản phẩm.`
        : "Sản phẩm hiện đã hết hàng.",
    );
  }

  return warnings.length ? warnings.join(" ") : undefined;
}

export function mapCartItems(snapshot: CartSnapshot): CartLineItemViewModel[] {
  return snapshot.items.map((item) => ({
    lineId: item.variantId,
    productName: item.productTitle,
    productSlug: item.productSlug,
    quantity: item.quantity,
    unitPriceVnd: item.currentPriceVnd,
    variantId: item.variantId,
    variantLabel: item.sku,
    warning: getCartWarning(item),
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

export function getCartPageMessage(input: {
  error?: string | string[];
  status?: string | string[];
}): { kind: "error" | "success"; text: string } | undefined {
  const status = Array.isArray(input.status) ? input.status[0] : input.status;
  if (status === "updated") {
    return { kind: "success", text: "Đã cập nhật số lượng trong giỏ hàng." };
  }
  if (status === "removed") {
    return { kind: "success", text: "Đã xóa sản phẩm khỏi giỏ hàng." };
  }

  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  const messages: Record<string, string> = {
    changed: "Giỏ hàng đã thay đổi ở một yêu cầu khác. Trang đã tải lại dữ liệu mới nhất; vui lòng thử lại.",
    expired: "Giỏ hàng trước đó không còn hiệu lực. Hãy thêm lại sản phẩm bạn muốn mua.",
    invalid: "Số lượng hoặc sản phẩm gửi lên không hợp lệ.",
    service: "Chưa thể cập nhật giỏ hàng lúc này. Vui lòng thử lại sau.",
    stock: "Số lượng yêu cầu vượt quá tồn kho hiện tại.",
    unavailable: "Sản phẩm này hiện không còn được bán.",
  };

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}
