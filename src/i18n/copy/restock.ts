import { defineCopy } from "@/i18n/storefront";

/** "Tell me when this is back" surface on an out-of-stock variant. */
export const restockCopy = defineCopy({
  vi: {
    heading: "Thông báo khi có hàng",
    description:
      "Để lại email, cửa hàng sẽ báo ngay khi phiên bản này có tồn kho trở lại.",
    fieldEmail: "Email nhận thông báo",
    submit: "Nhận thông báo",
    alreadyNotice: "Email này đã đăng ký nhận thông báo cho phiên bản đang chọn.",
    successNotice: "Đã ghi nhận. Cửa hàng sẽ email khi mặt hàng có tồn kho trở lại.",
    errors: {
      invalid: "Email chưa hợp lệ. Hãy kiểm tra lại.",
      throttled: "Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.",
      unavailable: "Phiên bản này hiện không nhận đăng ký thông báo.",
      service: "Chưa thể ghi nhận yêu cầu. Không có thay đổi nào được lưu.",
    },
  },
  en: {
    heading: "Notify me when it is back",
    description:
      "Leave your email and the shop will write to you as soon as this variant is in stock again.",
    fieldEmail: "Email for the alert",
    submit: "Notify me",
    alreadyNotice: "That email is already registered for the selected variant.",
    successNotice: "Recorded. The shop will email you when the item is back in stock.",
    errors: {
      invalid: "That email is not valid. Please check it.",
      throttled: "You have sent too many requests. Please try again later.",
      unavailable: "This variant is not accepting restock alerts right now.",
      service: "The request could not be recorded. Nothing was saved.",
    },
  },
});
