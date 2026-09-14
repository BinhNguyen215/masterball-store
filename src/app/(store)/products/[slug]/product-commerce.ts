import { z } from "zod";

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

export function getProductCartMessage(input: {
  cart?: string | string[];
  error?: string | string[];
}): { kind: "error" | "success"; text: string } | undefined {
  if (input.cart === "added") {
    return { kind: "success", text: "Đã thêm sản phẩm vào giỏ hàng." };
  }

  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  const messages: Record<string, string> = {
    changed: "Giỏ hàng vừa được cập nhật ở yêu cầu khác. Vui lòng thử lại.",
    invalid: "Phiên bản hoặc số lượng sản phẩm không hợp lệ.",
    service: "Chưa thể cập nhật giỏ hàng lúc này. Vui lòng thử lại sau.",
    stock: "Số lượng bạn chọn vượt quá tồn kho hiện tại.",
    unavailable: "Phiên bản này hiện không còn được bán.",
  };

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}
