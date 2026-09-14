import { AlertTriangle, LockKeyhole } from "lucide-react";

import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { CartLineItemViewModel } from "@/components/storefront/storefront-types";

type CheckoutAction = (formData: FormData) => Promise<void>;

type CheckoutViewProps = {
  cartVersion?: number;
  checkoutAction?: CheckoutAction;
  enabled: boolean;
  items: CartLineItemViewModel[];
  message?: { kind: "error" | "success"; text: string };
  subtotalVnd: number;
};

export function CheckoutView({
  cartVersion,
  checkoutAction,
  enabled,
  items,
  message,
  subtotalVnd,
}: CheckoutViewProps) {
  const hcmShippingVnd = 30_000;
  const otherShippingVnd = 40_000;

  return (
    <div className="checkout-layout">
      <section
        aria-labelledby="checkout-details-title"
        className="checkout-panel"
        data-disabled={!enabled}
      >
        <h2 id="checkout-details-title">Thông tin nhận hàng</h2>
        {message ? (
          <div className="notice" role={message.kind === "error" ? "alert" : "status"}>
            <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
            <p>{message.text}</p>
          </div>
        ) : null}
        <form action={checkoutAction} className="checkout-form">
          <input name="cartVersion" type="hidden" value={cartVersion} />
          <div className="field">
            <label className="field-label" htmlFor="checkout-name">
              Họ và tên
            </label>
            <input
              autoComplete="name"
              disabled={!enabled}
              id="checkout-name"
              maxLength={120}
              name="recipientName"
              placeholder="Nguyễn Minh Anh…"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-phone">
              Số điện thoại
            </label>
            <input
              autoComplete="tel"
              disabled={!enabled}
              id="checkout-phone"
              inputMode="tel"
              maxLength={20}
              name="phone"
              placeholder="0901 234 567…"
              required
              type="tel"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-email">
              Email <span className="field-help">(không bắt buộc)</span>
            </label>
            <input
              autoComplete="email"
              disabled={!enabled}
              id="checkout-email"
              inputMode="email"
              maxLength={320}
              name="email"
              placeholder="ban@example.com…"
              spellCheck={false}
              type="email"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-line-1">
              Số nhà và tên đường
            </label>
            <input
              autoComplete="address-line1"
              disabled={!enabled}
              id="checkout-line-1"
              maxLength={250}
              name="line1"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-line-2">
              Thông tin địa chỉ bổ sung <span className="field-help">(không bắt buộc)</span>
            </label>
            <input
              autoComplete="address-line2"
              disabled={!enabled}
              id="checkout-line-2"
              maxLength={250}
              name="line2"
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-ward">
              Phường hoặc xã <span className="field-help">(không bắt buộc)</span>
            </label>
            <input
              autoComplete="address-level3"
              disabled={!enabled}
              id="checkout-ward"
              maxLength={120}
              name="ward"
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-district">
              Quận, huyện hoặc thành phố trực thuộc tỉnh
            </label>
            <input
              autoComplete="address-level2"
              disabled={!enabled}
              id="checkout-district"
              maxLength={120}
              name="district"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-province">
              Tỉnh hoặc thành phố
            </label>
            <input
              autoComplete="address-level1"
              disabled={!enabled}
              id="checkout-province"
              maxLength={120}
              name="province"
              placeholder="TP. Hồ Chí Minh…"
              required
              type="text"
            />
            <p className="field-help">
              Phí giao nội địa do máy chủ tính: TP.HCM 30.000 ₫; tỉnh/thành khác 40.000 ₫.
              Hiện chưa hỗ trợ nhận tại cửa hàng.
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-payment-method">
              Phương thức thanh toán
            </label>
            <select
              defaultValue="COD"
              disabled={!enabled}
              id="checkout-payment-method"
              name="paymentMethod"
              required
            >
              <option value="COD">Thanh toán khi nhận hàng (COD)</option>
              <option value="VNPAY">Thanh toán trực tuyến qua VNPAY</option>
            </select>
            <p className="field-help">
              Trang quay về từ VNPAY chỉ hiển thị kết quả. Đơn chỉ được ghi nhận đã thanh toán
              sau khi máy chủ xác minh thông báo từ VNPAY.
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-note">
              Ghi chú đơn hàng <span className="field-help">(không bắt buộc)</span>
            </label>
            <textarea
              disabled={!enabled}
              id="checkout-note"
              maxLength={1000}
              name="customerNote"
              rows={4}
            />
          </div>
          <button className="button button--primary" disabled={!enabled} type="submit">
            <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.8} />
            {enabled ? "Xác nhận đặt hàng" : "Chưa thể đặt hàng"}
          </button>
        </form>
      </section>
      <aside aria-labelledby="checkout-summary-title" className="summary-panel">
        <h2 id="checkout-summary-title">Đơn hàng</h2>
        {items.length ? (
          <dl className="order-summary-list">
            {items.map((item) => (
              <div className="order-summary-row" key={item.lineId}>
                <dt>
                  {item.productName} × {item.quantity}
                  <span className="field-help"> {item.variantLabel}</span>
                  {item.warning ? (
                    <span className="cart-warning"> {item.warning}</span>
                  ) : null}
                </dt>
                <dd>{formatVnd(item.unitPriceVnd * item.quantity)}</dd>
              </div>
            ))}
            <div className="order-summary-row">
              <dt>Tạm tính</dt>
              <dd>{formatVnd(subtotalVnd)}</dd>
            </div>
            <div className="order-summary-row">
              <dt>Tổng tại TP.HCM</dt>
              <dd>{formatVnd(subtotalVnd + hcmShippingVnd)}</dd>
            </div>
            <div className="order-summary-row">
              <dt>Tổng tại tỉnh/thành khác</dt>
              <dd>{formatVnd(subtotalVnd + otherShippingVnd)}</dd>
            </div>
          </dl>
        ) : (
          <p className="field-help">
            Chưa có giỏ hàng đã được máy chủ xác thực. Không có tổng tiền tạm nào được gửi từ
            trình duyệt.
          </p>
        )}
      </aside>
    </div>
  );
}
