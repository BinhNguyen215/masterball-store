import { defineCopy } from "@/i18n/storefront";

/** Customer-facing review surfaces: the summary, the list and the form. */
export const reviewsCopy = defineCopy({
  vi: {
    heading: "Đánh giá từ người mua",
    summaryAria: "Tóm tắt đánh giá",
    averageLabel: "Điểm trung bình",
    countLabel: "{count} đánh giá đã kiểm duyệt",
    empty: "Chưa có đánh giá nào được kiểm duyệt cho sản phẩm này.",
    verified: "Đã mua tại cửa hàng",
    formTitle: "Viết đánh giá",
    formDescription:
      "Đánh giá chỉ được gửi khi mã đơn và số điện thoại đặt hàng trùng khớp, nên mọi đánh giá đều đến từ người đã mua.",
    formName: "Tên hiển thị",
    formOrderNumber: "Mã đơn hàng",
    formPhone: "Số điện thoại đặt hàng",
    formRating: "Số sao",
    formBody: "Nhận xét",
    formBodyHint: "Từ 10 đến 2000 ký tự.",
    formSubmit: "Gửi đánh giá",
    pendingNotice:
      "Đánh giá đã được ghi nhận và đang chờ cửa hàng kiểm duyệt. Nội dung chỉ hiển thị sau khi được duyệt.",
    errors: {
      notFound: "Không tìm thấy đơn hàng khớp với mã đơn và số điện thoại đã nhập.",
      duplicate: "Bạn đã đánh giá sản phẩm này trong đơn hàng đó.",
      invalid: "Thông tin đánh giá chưa hợp lệ. Hãy kiểm tra lại.",
      throttled: "Bạn đã gửi quá nhiều đánh giá. Hãy thử lại sau.",
      service: "Chưa thể gửi đánh giá. Không có thay đổi nào được ghi.",
    },
  },
  en: {
    heading: "Buyer reviews",
    summaryAria: "Review summary",
    averageLabel: "Average rating",
    countLabel: "{count} moderated reviews",
    empty: "No moderated review yet for this product.",
    verified: "Bought from the shop",
    formTitle: "Write a review",
    formDescription:
      "A review is accepted only when the order number and the phone number used at checkout match, so every review comes from a real buyer.",
    formName: "Display name",
    formOrderNumber: "Order number",
    formPhone: "Phone used at checkout",
    formRating: "Rating",
    formBody: "Your review",
    formBodyHint: "Between 10 and 2000 characters.",
    formSubmit: "Submit review",
    pendingNotice:
      "Your review was recorded and is waiting for the shop to moderate it. It appears only after approval.",
    errors: {
      notFound: "No order matches that order number and phone number.",
      duplicate: "You already reviewed this product in that order.",
      invalid: "The review details are not valid. Please check them.",
      throttled: "You have submitted too many reviews. Please try again later.",
      service: "The review could not be submitted. Nothing was recorded.",
    },
  },
});
