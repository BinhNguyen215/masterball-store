import { createHash } from "node:crypto";

import { z } from "zod";

import { checkoutAddressSchema } from "@/modules/checkout";

const checkoutFormSchema = z.object({
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

function normalizeVietnamesePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

export function getVietnamShippingFee(address: { province: string }): number {
  const province = normalizeVietnamesePlace(address.province);
  return [
    "hcm",
    "hochiminh",
    "tphcm",
    "tphochiminh",
    "thanhphohochiminh",
  ].includes(province)
    ? 30_000
    : 40_000;
}

export function createCheckoutIdempotencyKey(
  cartToken: string,
  cartVersion: number,
): string {
  return createHash("sha256")
    .update(`storefront-checkout:${cartToken}:${cartVersion}`)
    .digest("hex");
}

export function getCheckoutPageMessage(input: {
  error?: string | string[];
}): { kind: "error"; text: string } | undefined {
  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  const messages: Record<string, string> = {
    cart: "Giỏ hàng không còn hiệu lực. Vui lòng quay lại giỏ hàng và thử lại.",
    changed: "Giỏ hàng đã thay đổi sau khi bạn mở trang thanh toán. Vui lòng kiểm tra lại giỏ hàng.",
    invalid: "Thông tin nhận hàng chưa hợp lệ. Vui lòng kiểm tra các trường bắt buộc.",
    payment: "Thanh toán VNPAY hiện chưa khả dụng. Bạn có thể chọn COD hoặc thử lại sau.",
    service: "Chưa thể tạo đơn hàng lúc này. Không có thanh toán nào được xác nhận; vui lòng thử lại.",
    stock: "Một sản phẩm không còn đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.",
  };

  return error && messages[error]
    ? { kind: "error", text: messages[error] }
    : undefined;
}
