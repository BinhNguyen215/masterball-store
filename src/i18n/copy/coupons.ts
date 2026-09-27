import { defineCopy } from "@/i18n/storefront";

/** Coupon field shown in the cart and at checkout. */
export const couponsCopy = defineCopy({
  vi: {
    fieldLabel: "Mã giảm giá",
    fieldPlaceholder: "Ví dụ: TCG50",
    apply: "Áp dụng",
    remove: "Bỏ mã",
    appliedLabel: "Đã áp dụng {code}",
    discountLabel: "Giảm giá",
    emptyHint: "Nhập mã nếu bạn có phiếu giảm giá của cửa hàng.",
    errors: {
      notFound: "Mã giảm giá không tồn tại.",
      inactive: "Mã giảm giá đã bị tạm dừng.",
      expired: "Mã giảm giá đã hết hiệu lực.",
      notStarted: "Mã giảm giá chưa đến thời gian sử dụng.",
      minOrder: "Đơn hàng chưa đạt giá trị tối thiểu để dùng mã này.",
      exhausted: "Mã giảm giá đã hết lượt sử dụng.",
      invalid: "Mã giảm giá không hợp lệ.",
      service: "Chưa thể kiểm tra mã giảm giá. Vui lòng thử lại.",
    },
  },
  en: {
    fieldLabel: "Discount code",
    fieldPlaceholder: "For example: TCG50",
    apply: "Apply",
    remove: "Remove code",
    appliedLabel: "{code} applied",
    discountLabel: "Discount",
    emptyHint: "Enter a code if you hold one of the shop's vouchers.",
    errors: {
      notFound: "That discount code does not exist.",
      inactive: "That discount code is paused.",
      expired: "That discount code has expired.",
      notStarted: "That discount code is not active yet.",
      minOrder: "The order does not reach the minimum value for this code.",
      exhausted: "That discount code has no uses left.",
      invalid: "The discount code is not valid.",
      service: "The discount code could not be checked. Please try again.",
    },
  },
});
