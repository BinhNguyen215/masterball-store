import type { OrderStatusViewModel } from "@/components/storefront/storefront-types";

const lookupTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function isValidOrderLookupToken(token: string): boolean {
  return lookupTokenPattern.test(token);
}

type StorefrontOrder = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  createdAt: Date;
  items: Array<{
    id: string;
    productTitle: string;
    variantSku: string;
    unitPriceVnd: number;
    quantity: number;
    lineTotalVnd: number;
  }>;
};

const orderLabels: Record<string, string> = {
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã hoàn tất",
  CONFIRMED: "Đã xác nhận",
  PENDING_PAYMENT: "Đang chờ thanh toán",
};

const paymentLabels: Record<string, string> = {
  FAILED: "Thanh toán không thành công",
  MANUAL_REVIEW: "Đang đối soát thủ công",
  PAID: "Đã thanh toán",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  PENDING: "Đang chờ xác nhận",
  REFUNDED: "Đã hoàn tiền",
  UNPAID: "Thanh toán khi nhận hàng",
};

const fulfillmentLabels: Record<string, string> = {
  DELIVERED: "Đã giao",
  PROCESSING: "Đang chuẩn bị hàng",
  RETURNED: "Đã hoàn hàng",
  SHIPPED: "Đang giao",
  UNFULFILLED: "Chưa xử lý giao hàng",
};

export function mapOrderForStorefront(order: StorefrontOrder): OrderStatusViewModel {
  return {
    createdAt: order.createdAt.toISOString(),
    fulfillmentStatusLabel:
      fulfillmentLabels[order.fulfillmentStatus] ?? "Đang cập nhật",
    items: order.items.map((item) => ({
      lineId: item.id,
      lineTotalVnd: item.lineTotalVnd,
      productName: item.productTitle,
      quantity: item.quantity,
      unitPriceVnd: item.unitPriceVnd,
      variantLabel: item.variantSku,
    })),
    paymentMethodLabel:
      order.paymentMethod === "VNPAY"
        ? "VNPAY"
        : order.paymentMethod === "COD"
          ? "Thanh toán khi nhận hàng"
          : "Đang cập nhật",
    paymentStatusLabel: paymentLabels[order.paymentStatus] ?? "Đang cập nhật",
    reference: order.orderNumber,
    shippingVnd: order.shippingVnd,
    statusLabel: orderLabels[order.orderStatus] ?? "Đang cập nhật",
    subtotalVnd: order.subtotalVnd,
    totalVnd: order.totalVnd,
  };
}
