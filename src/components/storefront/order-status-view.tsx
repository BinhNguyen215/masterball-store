import { PackageSearch, ReceiptText } from "lucide-react";

import { EmptyState } from "@/components/storefront/empty-state";
import {
  formatVietnamDateTime,
  formatVnd,
} from "@/components/storefront/storefront-formatters";
import type { OrderStatusViewModel } from "@/components/storefront/storefront-types";

export function OrderStatusView({ order }: { order: OrderStatusViewModel | null }) {
  if (!order) {
    return (
      <EmptyState
        actionHref="/products"
        actionLabel="Về cửa hàng"
        description="Dịch vụ tra cứu đơn chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu. Trang này không xác nhận rằng đơn đã được tạo hoặc thanh toán."
        icon={PackageSearch}
        title="Chưa thể tra cứu đơn"
      />
    );
  }

  return (
    <div className="order-layout">
      <section className="summary-panel">
        <span aria-hidden="true" className="state-icon">
          <ReceiptText size={22} strokeWidth={1.8} />
        </span>
        <h2>Đơn {order.reference}</h2>
        <p>{order.statusLabel}</p>
        <p className="field-help">Tạo lúc {formatVietnamDateTime(order.createdAt)}</p>
      </section>
      <section aria-labelledby="order-status-title" className="summary-panel">
        <h2 id="order-status-title">Trạng thái hiện tại</h2>
        <dl className="order-summary-list">
          <div className="order-summary-row">
            <dt>Phương thức</dt>
            <dd>{order.paymentMethodLabel}</dd>
          </div>
          <div className="order-summary-row">
            <dt>Thanh toán</dt>
            <dd>{order.paymentStatusLabel}</dd>
          </div>
          <div className="order-summary-row">
            <dt>Xử lý đơn</dt>
            <dd>{order.fulfillmentStatusLabel}</dd>
          </div>
        </dl>
        <p className="field-help">
          Kết quả trên URL quay về từ cổng thanh toán chỉ dùng để hiển thị. Trạng thái thanh
          toán chỉ thay đổi sau khi máy chủ xác minh thông báo từ nhà cung cấp.
        </p>
      </section>
      <section aria-labelledby="order-items-title" className="summary-panel">
        <h2 id="order-items-title">Sản phẩm</h2>
        <dl className="order-summary-list">
          {order.items.map((item) => (
            <div className="order-summary-row" key={item.lineId}>
              <dt>
                {item.productName} × {item.quantity}
                <span className="field-help"> {item.variantLabel}</span>
              </dt>
              <dd>{formatVnd(item.lineTotalVnd)}</dd>
            </div>
          ))}
          <div className="order-summary-row">
            <dt>Tạm tính</dt>
            <dd>{formatVnd(order.subtotalVnd)}</dd>
          </div>
          <div className="order-summary-row">
            <dt>Phí giao hàng</dt>
            <dd>{formatVnd(order.shippingVnd)}</dd>
          </div>
          <div className="order-summary-row">
            <dt>Tổng cộng</dt>
            <dd>{formatVnd(order.totalVnd)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
