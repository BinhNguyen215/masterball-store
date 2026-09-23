import { defineCopy } from "@/i18n/storefront";

export const checkoutCopy = defineCopy({
  vi: {
    cart: {
      metaTitle: "Giỏ hàng",
      metaDescription: "Kiểm tra sản phẩm, số lượng và giá trước khi thanh toán.",
      breadcrumb: "Giỏ hàng",
      checkout: "Tiến hành thanh toán",
      description:
        "Mọi thay đổi về giá hoặc tồn kho phải được xác nhận rõ trước khi bạn tiếp tục.",
      emptyAction: "Khám phá sản phẩm",
      emptyDescription:
        "Giỏ hàng chưa có sản phẩm. Giá và tồn kho sẽ được kiểm tra lại khi bạn thêm hàng từ catalog.",
      emptyTitle: "Giỏ hàng đang trống",
      errors: {
        changed:
          "Giỏ hàng đã thay đổi ở một yêu cầu khác. Trang đã tải lại dữ liệu mới nhất; vui lòng thử lại.",
        expired:
          "Giỏ hàng trước đó không còn hiệu lực. Hãy thêm lại sản phẩm bạn muốn mua.",
        invalid: "Số lượng hoặc sản phẩm gửi lên không hợp lệ.",
        service: "Chưa thể cập nhật giỏ hàng lúc này. Vui lòng thử lại sau.",
        stock: "Số lượng yêu cầu vượt quá tồn kho hiện tại.",
        unavailable: "Sản phẩm này hiện không còn được bán.",
      },
      itemsHeading: "Sản phẩm trong giỏ",
      messageInactive:
        "Giỏ hàng trước đó không còn hiệu lực. Hãy thêm lại sản phẩm bạn muốn mua.",
      messageLoadFailed: "Chưa thể tải giỏ hàng lúc này. Vui lòng thử lại sau.",
      messageRemoved: "Đã xóa sản phẩm khỏi giỏ hàng.",
      messageUnavailable:
        "Giỏ hàng chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu.",
      messageUnopenable:
        "Không thể mở giỏ hàng này. Hãy thêm lại sản phẩm bạn muốn mua.",
      messageUpdated: "Đã cập nhật số lượng trong giỏ hàng.",
      notReady:
        "Chưa thể thanh toán vì giỏ hàng có sản phẩm hết hoặc thiếu tồn kho.",
      quantity: "Số lượng",
      remove: "Xóa",
      shipping: "Phí giao hàng",
      shippingPending: "Xác nhận khi thanh toán",
      subtotal: "Tạm tính",
      summaryTitle: "Tóm tắt giỏ hàng",
      title: "Kiểm tra giỏ hàng",
      update: "Cập nhật",
      warningPriceChanged: "Giá đã đổi từ {from} thành {to}.",
      warningSoldOut: "Sản phẩm hiện đã hết hàng.",
      warningStockLeft: "Hiện chỉ còn {count} sản phẩm.",
    },
    checkout: {
      metaTitle: "Thanh toán",
      metaDescription: "Nhập thông tin nhận hàng và xác nhận đơn mua TCG.",
      breadcrumb: "Thanh toán",
      codHint: "Thanh toán cho nhân viên giao hàng",
      codTitle: "Thanh toán tiền mặt khi nhận hàng - COD",
      consentConjunction: "và",
      consentPrefix: "Tôi đã đọc và đồng ý với",
      consentPrivacy: "chính sách quyền riêng tư",
      consentReturns: "chính sách đổi trả",
      consentTerms: "điều khoản mua hàng",
      description:
        "Giá, tồn kho và lựa chọn thanh toán phải được xác thực trước khi đơn hàng được tạo.",
      detailsTitle: "Thông tin nhận hàng",
      district: "Quận, huyện hoặc thành phố trực thuộc tỉnh",
      email: "Email",
      emailPlaceholder: "ban@example.com…",
      errors: {
        cart: "Giỏ hàng không còn hiệu lực. Vui lòng quay lại giỏ hàng và thử lại.",
        changed:
          "Giỏ hàng đã thay đổi sau khi bạn mở trang thanh toán. Vui lòng kiểm tra lại giỏ hàng.",
        consent:
          "Bạn cần đồng ý với điều khoản mua hàng và chính sách riêng tư trước khi đặt hàng.",
        invalid:
          "Thông tin nhận hàng chưa hợp lệ. Vui lòng kiểm tra các trường bắt buộc.",
        payment:
          "Thanh toán VNPAY hiện chưa khả dụng. Bạn có thể chọn COD hoặc thử lại sau.",
        service:
          "Chưa thể tạo đơn hàng lúc này. Không có thanh toán nào được xác nhận; vui lòng thử lại.",
        stock: "Một sản phẩm không còn đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.",
      },
      line1: "Số nhà và tên đường",
      line2: "Thông tin địa chỉ bổ sung",
      messageEmptyCart:
        "Giỏ hàng trống, đã hết hiệu lực hoặc có sản phẩm không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.",
      messageExpired: "Giỏ hàng không còn hiệu lực. Vui lòng quay lại giỏ hàng.",
      messageLoadFailed: "Chưa thể tải giỏ hàng lúc này. Vui lòng thử lại sau.",
      messageNoCart: "Bạn chưa có giỏ hàng để thanh toán.",
      messageUnavailable:
        "Thanh toán chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu.",
      name: "Họ và tên",
      namePlaceholder: "Nguyễn Minh Anh…",
      note: "Ghi chú đơn hàng",
      optional: "(không bắt buộc)",
      paymentLegend: "Phương thức thanh toán",
      phone: "Số điện thoại",
      phonePlaceholder: "0901 234 567…",
      province: "Tỉnh hoặc thành phố",
      provinceHelp:
        "Phí giao nội địa do máy chủ tính theo tỉnh/thành: TP. Hồ Chí Minh {hcm}; tỉnh/thành khác {other}. Hiện chưa hỗ trợ nhận tại cửa hàng.",
      provincePlaceholder: "TP. Hồ Chí Minh…",
      provincePlaceholderOption: "Chọn tỉnh hoặc thành phố",
      qrHint: "Sắp ra mắt · Cần cấu hình tài khoản nhận tiền",
      qrTitle: "Chuyển khoản qua QR - VCB",
      shipping: "Phí giao hàng",
      shippingPending: "Xác nhận khi thanh toán",
      shippingRegionHcm: "TP. Hồ Chí Minh",
      shippingRegionOther: "Tỉnh/thành khác",
      submit: "Xác nhận đặt hàng",
      submitDisabled: "Chưa thể đặt hàng",
      subtotal: "Tạm tính",
      summaryEmpty:
        "Chưa có giỏ hàng đã được máy chủ xác thực. Không có tổng tiền tạm nào được gửi từ trình duyệt.",
      summaryTitle: "Đơn hàng",
      title: "Hoàn tất đơn hàng",
      total: "Tổng cộng",
      totalExcludingShipping: "Tổng chưa gồm phí giao hàng",
      vnpayHint: "Thanh toán bảo mật qua cổng VNPAY",
      vnpayNote:
        "VNPAY chỉ được xác nhận sau khi máy chủ kiểm tra callback hợp lệ.",
      vnpayTitle: "Thanh toán online qua ATM / Visa / MasterCard / JCB / QR Pay",
      ward: "Phường hoặc xã",
    },
  },
  en: {
    cart: {
      metaTitle: "Cart",
      metaDescription: "Review items, quantities and prices before checkout.",
      breadcrumb: "Cart",
      checkout: "Continue to checkout",
      description:
        "Every price or stock change must be confirmed before you continue.",
      emptyAction: "Browse products",
      emptyDescription:
        "There are no products in your cart yet. Prices and stock are checked again when you add items from the catalog.",
      emptyTitle: "Your cart is empty",
      errors: {
        changed:
          "The cart changed in another request. The page reloaded the latest data; please try again.",
        expired:
          "The previous cart is no longer valid. Please add the products you want again.",
        invalid: "The quantity or product submitted is not valid.",
        service: "The cart can't be updated right now. Please try again later.",
        stock: "The requested quantity exceeds the current stock.",
        unavailable: "This product is no longer for sale.",
      },
      itemsHeading: "Items in your cart",
      messageInactive:
        "The previous cart is no longer valid. Please add the products you want again.",
      messageLoadFailed: "Your cart can't be loaded right now. Please try again later.",
      messageRemoved: "Product removed from your cart.",
      messageUnavailable:
        "The cart is unavailable because the store is not connected to a database.",
      messageUnopenable:
        "This cart could not be opened. Please add the products you want again.",
      messageUpdated: "Cart quantity updated.",
      notReady:
        "Checkout is unavailable while your cart has sold-out or low-stock items.",
      quantity: "Quantity",
      remove: "Remove",
      shipping: "Shipping",
      shippingPending: "Confirmed at checkout",
      subtotal: "Subtotal",
      summaryTitle: "Cart summary",
      title: "Review your cart",
      update: "Update",
      warningPriceChanged: "The price changed from {from} to {to}.",
      warningSoldOut: "This product is out of stock.",
      warningStockLeft: "Only {count} left in stock.",
    },
    checkout: {
      metaTitle: "Checkout",
      metaDescription: "Enter delivery details and confirm your TCG order.",
      breadcrumb: "Checkout",
      codHint: "Pay the delivery courier",
      codTitle: "Cash on delivery - COD",
      consentConjunction: "and",
      consentPrefix: "I have read and agree to the",
      consentPrivacy: "privacy policy",
      consentReturns: "returns policy",
      consentTerms: "purchase terms",
      description:
        "Prices, stock and payment options are verified before the order is created.",
      detailsTitle: "Delivery details",
      district: "District or city under a province",
      email: "Email",
      emailPlaceholder: "you@example.com…",
      errors: {
        cart: "The cart is no longer valid. Please go back to the cart and try again.",
        changed:
          "The cart changed after you opened checkout. Please review your cart again.",
        consent:
          "You must accept the purchase terms and the privacy policy before ordering.",
        invalid:
          "The delivery details are not valid. Please check the required fields.",
        payment:
          "VNPAY payment is unavailable right now. You can choose COD or try again later.",
        service:
          "The order can't be created right now. No payment was confirmed; please try again.",
        stock: "A product no longer has enough stock. Please review your cart again.",
      },
      line1: "Street address",
      line2: "Additional address details",
      messageEmptyCart:
        "The cart is empty, expired, or has items without enough stock. Please review your cart.",
      messageExpired: "The cart is no longer valid. Please go back to the cart.",
      messageLoadFailed: "Your cart can't be loaded right now. Please try again later.",
      messageNoCart: "You don't have a cart to check out.",
      messageUnavailable:
        "Checkout is unavailable because the store is not connected to a database.",
      name: "Full name",
      namePlaceholder: "Nguyen Minh Anh…",
      note: "Order note",
      optional: "(optional)",
      paymentLegend: "Payment method",
      phone: "Phone number",
      phonePlaceholder: "0901 234 567…",
      province: "Province or city",
      provinceHelp:
        "Domestic shipping is calculated by the server per province/city: Ho Chi Minh City {hcm}; other provinces/cities {other}. In-store pickup is not supported yet.",
      provincePlaceholder: "Ho Chi Minh City…",
      provincePlaceholderOption: "Select a province or city",
      qrHint: "Coming soon · Requires a configured receiving account",
      qrTitle: "Bank transfer via QR - VCB",
      shipping: "Shipping",
      shippingPending: "Confirmed at checkout",
      shippingRegionHcm: "Ho Chi Minh City",
      shippingRegionOther: "Other provinces",
      submit: "Place order",
      submitDisabled: "Checkout unavailable",
      subtotal: "Subtotal",
      summaryEmpty:
        "No server-validated cart yet. No temporary total is sent from the browser.",
      summaryTitle: "Order",
      title: "Complete your order",
      total: "Total",
      totalExcludingShipping: "Total excluding shipping",
      vnpayHint: "Secure payment through the VNPAY gateway",
      vnpayNote:
        "VNPAY is only confirmed after the server validates the callback.",
      vnpayTitle: "Pay online with ATM / Visa / MasterCard / JCB / QR Pay",
      ward: "Ward or commune",
    },
  },
});
