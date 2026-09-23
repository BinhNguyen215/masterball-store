import { defineCopy } from "@/i18n/storefront";

export const ordersCopy = defineCopy({
  vi: {
    metaTitle: "Tra cứu đơn hàng",
    metaDescription: "Tra cứu trạng thái đơn hàng bằng mã đơn và số điện thoại đã dùng khi đặt hàng.",
    tokenMetaDescription: "Tra cứu trạng thái đơn hàng MasterBall Store bằng liên kết bảo mật.",
    lookupTitle: "Theo dõi đơn hàng",
    lookupFormTitle: "Tra cứu đơn hàng",
    breadcrumb: "Tra cứu đơn",
    lookupDescription:
      "Nhập mã đơn và số điện thoại đã dùng khi đặt hàng. Trang này không hiển thị đơn của người khác và không xác nhận rằng đơn đã được thanh toán.",
    lookupAnother: "Tra cứu đơn khác",
    orderNumber: "Mã đơn hàng",
    orderNumberPlaceholder: "MB-1CD39059E3D48C785FAD…",
    orderNumberHelp:
      "Mã đơn nằm trong email xác nhận hoặc trên trang theo dõi sau khi đặt hàng.",
    phone: "Số điện thoại đặt hàng",
    phonePlaceholder: "0901 234 567…",
    lookup: "Tra cứu đơn",
    supportTitle: "Cần hỗ trợ?",
    supportDescription:
      "Trang này chỉ hiển thị đơn khớp đúng mã đơn và số điện thoại đã dùng khi đặt hàng. Hãy giữ liên kết theo dõi riêng tư trong email ở nơi an toàn và không chia sẻ công khai.",
    supportPrivateLink:
      "Nếu bạn đã có liên kết theo dõi riêng, hãy mở liên kết đó thay vì tra cứu lại.",
    tokenDescription:
      "Liên kết này chỉ nên được mở trên thiết bị bạn tin cậy. Không chia sẻ mã tra cứu công khai.",
    tokenLookupPrompt: "Cần tra cứu đơn khác?",
    tokenLookupLink: "Dùng mã đơn và số điện thoại đặt hàng",
    currentStatus: "Trạng thái hiện tại",
    orderHeading: "Đơn {reference}",
    createdAt: "Tạo {date}",
    paymentMethod: "Phương thức",
    payment: "Thanh toán",
    fulfillment: "Xử lý đơn",
    paymentNote:
      "Kết quả trên URL quay về từ cổng thanh toán chỉ dùng để hiển thị. Trạng thái thanh toán chỉ thay đổi sau khi máy chủ xác minh thông báo từ nhà cung cấp.",
    items: "Sản phẩm",
    itemLine: "{name} × {quantity}",
    subtotal: "Tạm tính",
    shipping: "Phí giao hàng",
    total: "Tổng cộng",
    unavailableTitle: "Chưa thể tra cứu đơn",
    unavailableDescription:
      "Dịch vụ tra cứu đơn chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu. Trang này không xác nhận rằng đơn đã được tạo hoặc thanh toán.",
    statusFallback: "Đang cập nhật",
    orderStatus: {
      cancelled: "Đã hủy",
      completed: "Đã hoàn tất",
      confirmed: "Đã xác nhận",
      pendingPayment: "Đang chờ thanh toán",
    },
    paymentStatus: {
      failed: "Thanh toán không thành công",
      manualReview: "Đang đối soát thủ công",
      paid: "Đã thanh toán",
      partiallyRefunded: "Đã hoàn một phần",
      pending: "Đang chờ xác nhận",
      refunded: "Đã hoàn tiền",
      unpaid: "Thanh toán khi nhận hàng",
    },
    fulfillmentStatus: {
      delivered: "Đã giao",
      processing: "Đang chuẩn bị hàng",
      returned: "Đã hoàn hàng",
      shipped: "Đang giao",
      unfulfilled: "Chưa xử lý giao hàng",
    },
    paymentMethodVnpay: "VNPAY",
    paymentMethodCod: "Thanh toán khi nhận hàng",
    message: {
      invalid:
        "Mã đơn hoặc số điện thoại chưa đúng định dạng. Hãy kiểm tra lại thông tin trong email xác nhận.",
      notfound:
        "Không tìm thấy đơn hàng khớp với mã đơn và số điện thoại này. Hãy kiểm tra lại hoặc liên hệ cửa hàng.",
      throttled:
        "Bạn đã thử tra cứu quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.",
      unavailable:
        "Dịch vụ tra cứu đơn chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu.",
    },
  },
  en: {
    metaTitle: "Order lookup",
    metaDescription: "Look up an order status with the order number and the phone used at checkout.",
    tokenMetaDescription: "Look up a MasterBall Store order status with a private link.",
    lookupTitle: "Track your order",
    lookupFormTitle: "Order lookup",
    breadcrumb: "Order lookup",
    lookupDescription:
      "Enter the order number and the phone number used at checkout. This page never shows someone else's order and does not confirm that an order has been paid.",
    lookupAnother: "Look up another order",
    orderNumber: "Order number",
    orderNumberPlaceholder: "MB-1CD39059E3D48C785FAD…",
    orderNumberHelp:
      "The order number is in your confirmation email or on the tracking page shown after checkout.",
    phone: "Phone used at checkout",
    phonePlaceholder: "0901 234 567…",
    lookup: "Find order",
    supportTitle: "Need help?",
    supportDescription:
      "This page only shows an order that matches both the order number and the phone number used at checkout. Keep the private tracking link from your email somewhere safe and never share it publicly.",
    supportPrivateLink:
      "If you already have a private tracking link, open that link instead of looking the order up again.",
    tokenDescription:
      "Open this link only on a device you trust. Never share the lookup code publicly.",
    tokenLookupPrompt: "Looking up a different order?",
    tokenLookupLink: "Use the order number and phone used at checkout",
    currentStatus: "Current status",
    orderHeading: "Order {reference}",
    createdAt: "Created {date}",
    paymentMethod: "Method",
    payment: "Payment",
    fulfillment: "Fulfilment",
    paymentNote:
      "Results returned from the payment gateway in the URL are display-only. Payment status changes only after the server verifies the provider's notification.",
    items: "Items",
    itemLine: "{name} × {quantity}",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    unavailableTitle: "Order lookup unavailable",
    unavailableDescription:
      "Order lookup is unavailable because the store is not connected to a database yet. This page does not confirm that an order was created or paid.",
    statusFallback: "Updating",
    orderStatus: {
      cancelled: "Cancelled",
      completed: "Completed",
      confirmed: "Confirmed",
      pendingPayment: "Awaiting payment",
    },
    paymentStatus: {
      failed: "Payment failed",
      manualReview: "Under manual review",
      paid: "Paid",
      partiallyRefunded: "Partially refunded",
      pending: "Awaiting confirmation",
      refunded: "Refunded",
      unpaid: "Pay on delivery",
    },
    fulfillmentStatus: {
      delivered: "Delivered",
      processing: "Preparing your order",
      returned: "Returned",
      shipped: "Shipped",
      unfulfilled: "Not yet fulfilled",
    },
    paymentMethodVnpay: "VNPAY",
    paymentMethodCod: "Cash on delivery",
    message: {
      invalid:
        "The order number or phone number is not in the expected format. Please check the details in your confirmation email.",
      notfound:
        "No order matches this order number and phone number. Please check again or contact the store.",
      throttled:
        "You have tried to look up an order too many times. Please wait a few minutes and try again.",
      unavailable:
        "Order lookup is unavailable because the store is not connected to a database yet.",
    },
  },
});
