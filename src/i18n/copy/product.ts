import { defineCopy } from "@/i18n/storefront";

export const productCopy = defineCopy({
  vi: {
    sku: "Mã SKU",
    type: "Loại",
    availability: "Tình trạng",
    variant: "Phiên bản",
    quantity: "Số lượng",
    addToCart: "Thêm vào giỏ",
    chooseVariant: "Chọn phiên bản",
    noSku: "Chưa có SKU",
    stockAvailable: "Còn {count} sản phẩm",
    outOfStock: "Tạm hết hàng",
    variantOutOfStockSuffix: " · Tạm hết",
    cartAdded: "Đã thêm sản phẩm vào giỏ hàng.",
    cartErrorChanged:
      "Giỏ hàng vừa được cập nhật ở yêu cầu khác. Vui lòng thử lại.",
    cartErrorInvalid: "Phiên bản hoặc số lượng sản phẩm không hợp lệ.",
    cartErrorService:
      "Chưa thể cập nhật giỏ hàng lúc này. Vui lòng thử lại sau.",
    cartErrorStock: "Số lượng bạn chọn vượt quá tồn kho hiện tại.",
    cartErrorUnavailable: "Phiên bản này hiện không còn được bán.",
    cartDisabled:
      "Chức năng thêm vào giỏ chỉ mở khi giá và tồn kho được xác thực từ hệ thống cửa hàng.",
    unavailableTitle: "Sản phẩm chưa sẵn sàng",
    unavailableDescription:
      "Dữ liệu sản phẩm chưa được kết nối hoặc mặt hàng này chưa được xuất bản. Không có giá hay tồn kho tạm nào được hiển thị.",
    metaDescription: "Trang chi tiết sản phẩm của MasterBall Store.",
  },
  en: {
    sku: "SKU",
    type: "Type",
    availability: "Availability",
    variant: "Edition",
    quantity: "Quantity",
    addToCart: "Add to cart",
    chooseVariant: "Choose an edition",
    noSku: "No SKU yet",
    stockAvailable: "{count} in stock",
    outOfStock: "Out of stock",
    variantOutOfStockSuffix: " · Out of stock",
    cartAdded: "Product added to your cart.",
    cartErrorChanged:
      "The cart was just updated by another request. Please try again.",
    cartErrorInvalid: "The edition or quantity submitted is not valid.",
    cartErrorService: "The cart can't be updated right now. Please try again later.",
    cartErrorStock: "The quantity you chose exceeds the stock currently available.",
    cartErrorUnavailable: "This edition is no longer for sale.",
    cartDisabled:
      "Add to cart opens once price and stock are verified by the store system.",
    unavailableTitle: "Product not ready",
    unavailableDescription:
      "Product data is not connected yet, or this item has not been published. No placeholder price or stock is shown.",
    metaDescription: "MasterBall Store product detail page.",
  },
});
