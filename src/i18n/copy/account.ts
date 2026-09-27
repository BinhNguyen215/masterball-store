import { defineCopy } from "@/i18n/storefront";

/** Shopper account surfaces: sign in, register, profile, own orders. */
export const accountCopy = defineCopy({
  vi: {
    metaTitle: "Tài khoản của bạn",
    metaDescription:
      "Đăng nhập hoặc tạo tài khoản MasterBall Store để xem đơn hàng bạn đã đặt.",
    breadcrumb: "Tài khoản",
    navLabel: "Tài khoản",
    title: "Tài khoản khách hàng",
    description:
      "Đăng nhập để giỏ hàng và đơn hàng của bạn luôn theo bạn trên thiết bị này. Bạn vẫn có thể mua hàng với tư cách khách nếu không muốn tạo tài khoản.",
    signInTitle: "Đăng nhập",
    signInDescription: "Dùng email và mật khẩu bạn đã đăng ký.",
    emailLabel: "Email",
    emailPlaceholder: "ban@example.com",
    passwordLabel: "Mật khẩu",
    rememberLabel: "Duy trì đăng nhập trên thiết bị này",
    signInSubmit: "Đăng nhập",
    signInPending: "Đang đăng nhập…",
    signInError: "Email hoặc mật khẩu không đúng.",
    registerTitle: "Tạo tài khoản",
    registerDescription:
      "Chỉ cần email và mật khẩu. Chúng tôi không đăng ký nhận tin quảng cáo thay bạn.",
    nameLabel: "Tên của bạn",
    namePlaceholder: "Nguyễn Văn A",
    passwordHelp: "Mật khẩu cần ít nhất 8 ký tự.",
    registerSubmit: "Tạo tài khoản",
    registerPending: "Đang tạo tài khoản…",
    registerError: "Không thể tạo tài khoản với thông tin này. Email có thể đã được dùng.",
    throttledError:
      "Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.",
    unavailableTitle: "Tài khoản tạm thời chưa khả dụng",
    unavailableDescription:
      "Cửa hàng chưa kết nối cơ sở dữ liệu nên bạn chưa thể đăng nhập hoặc tạo tài khoản lúc này.",
    profileTitle: "Thông tin tài khoản",
    profileNameLabel: "Tên",
    profileEmailLabel: "Email đăng nhập",
    greeting: "Xin chào {name}",
    ordersDescription: "Xem các đơn bạn đã đặt bằng tài khoản này.",
    ordersLink: "Đơn hàng của tôi",
    signOut: "Đăng xuất",
    signOutPending: "Đang thoát…",
    orders: {
      metaTitle: "Đơn hàng của tôi",
      metaDescription: "Danh sách đơn hàng bạn đã đặt bằng tài khoản này.",
      breadcrumb: "Đơn hàng của tôi",
      title: "Đơn hàng của tôi",
      description:
        "Mỗi đơn dưới đây được gắn với tài khoản của bạn. Bạn chỉ thấy đơn của chính mình.",
      emptyTitle: "Chưa có đơn hàng nào",
      emptyDescription:
        "Khi bạn đặt hàng bằng tài khoản này, đơn sẽ xuất hiện ở đây cùng trạng thái mới nhất.",
      emptyAction: "Tiếp tục mua sắm",
      unavailableTitle: "Chưa thể xem đơn hàng",
      unavailableDescription:
        "Cửa hàng chưa kết nối cơ sở dữ liệu nên danh sách đơn hàng tạm thời chưa khả dụng.",
      backToAccount: "Về trang tài khoản",
    },
  },
  en: {
    metaTitle: "Your account",
    metaDescription:
      "Sign in or create a MasterBall Store account to see the orders you placed.",
    breadcrumb: "Account",
    navLabel: "Account",
    title: "Customer account",
    description:
      "Sign in so your cart and orders follow you on this device. You can still check out as a guest without creating an account.",
    signInTitle: "Sign in",
    signInDescription: "Use the email and password you registered with.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    rememberLabel: "Keep me signed in on this device",
    signInSubmit: "Sign in",
    signInPending: "Signing in…",
    signInError: "That email or password is not correct.",
    registerTitle: "Create an account",
    registerDescription:
      "All you need is an email and a password. We never opt you into marketing.",
    nameLabel: "Your name",
    namePlaceholder: "Alex Nguyen",
    passwordHelp: "Your password needs at least 8 characters.",
    registerSubmit: "Create account",
    registerPending: "Creating your account…",
    registerError: "We could not create an account with those details. The email may be taken.",
    throttledError: "Too many attempts. Please wait a few minutes and try again.",
    unavailableTitle: "Accounts are temporarily unavailable",
    unavailableDescription:
      "The shop is not connected to its database yet, so you cannot sign in or create an account right now.",
    profileTitle: "Account details",
    profileNameLabel: "Name",
    profileEmailLabel: "Sign-in email",
    greeting: "Hello {name}",
    ordersDescription: "See the orders you placed with this account.",
    ordersLink: "My orders",
    signOut: "Sign out",
    signOutPending: "Signing out…",
    orders: {
      metaTitle: "My orders",
      metaDescription: "The orders you placed with this account.",
      breadcrumb: "My orders",
      title: "My orders",
      description:
        "Every order below belongs to your account. You only ever see your own orders.",
      emptyTitle: "No orders yet",
      emptyDescription:
        "Once you place an order with this account it appears here with its latest status.",
      emptyAction: "Continue shopping",
      unavailableTitle: "Orders are unavailable",
      unavailableDescription:
        "The shop is not connected to its database yet, so your order list cannot load.",
      backToAccount: "Back to your account",
    },
  },
});
