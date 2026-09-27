import { defineCopy } from "@/i18n/storefront";

/** Public tournament registration surface. */
export const registrationsCopy = defineCopy({
  vi: {
    heading: "Đăng ký tham dự",
    description:
      "Điền thông tin để giữ chỗ. Cửa hàng liên hệ xác nhận và thu phí tại quầy hoặc khi check-in.",
    fullNotice:
      "Giải đấu đã đủ chỗ. Đăng ký của bạn sẽ vào danh sách chờ và được xếp chỗ nếu có người hủy.",
    closedNotice: "Giải đấu đã đóng đăng ký hoặc đã kết thúc.",
    capacityLabel: "{registered}/{capacity} chỗ đã đăng ký",
    unlimitedCapacity: "{registered} chỗ đã đăng ký",
    waitlistLabel: "{count} người đang chờ",
    feeLabel: "Phí tham dự: {amount}",
    freeLabel: "Miễn phí tham dự",
    fieldName: "Họ và tên",
    fieldPhone: "Số điện thoại",
    fieldEmail: "Email (không bắt buộc)",
    fieldNote: "Ghi chú (không bắt buộc)",
    submit: "Giữ chỗ cho tôi",
    registeredNotice: "Bạn đã có chỗ trong giải đấu này.",
    waitlistedNotice: "Giải đấu đã đủ chỗ nên bạn đang ở danh sách chờ.",
    existingNotice: "Số điện thoại này đã đăng ký giải đấu.",
    errors: {
      invalid: "Thông tin đăng ký chưa hợp lệ. Hãy kiểm tra lại.",
      throttled: "Bạn đã gửi quá nhiều đăng ký. Hãy thử lại sau.",
      unavailable: "Giải đấu này hiện không nhận đăng ký.",
      service: "Chưa thể ghi nhận đăng ký. Không có thay đổi nào được lưu.",
    },
  },
  en: {
    heading: "Register to play",
    description:
      "Send your details to hold a seat. The shop confirms with you and collects the fee at the counter or at check-in.",
    fullNotice:
      "This event is full. Your registration joins the waiting list and takes a seat if someone cancels.",
    closedNotice: "Registration for this event is closed or the event has ended.",
    capacityLabel: "{registered}/{capacity} seats registered",
    unlimitedCapacity: "{registered} seats registered",
    waitlistLabel: "{count} people waiting",
    feeLabel: "Entry fee: {amount}",
    freeLabel: "Free entry",
    fieldName: "Full name",
    fieldPhone: "Phone number",
    fieldEmail: "Email (optional)",
    fieldNote: "Note (optional)",
    submit: "Hold my seat",
    registeredNotice: "You hold a seat in this event.",
    waitlistedNotice: "The event is full, so you are on the waiting list.",
    existingNotice: "That phone number is already registered for this event.",
    errors: {
      invalid: "The registration details are not valid. Please check them.",
      throttled: "You have submitted too many registrations. Please try again later.",
      unavailable: "This event is not accepting registrations right now.",
      service: "The registration could not be recorded. Nothing was saved.",
    },
  },
});
