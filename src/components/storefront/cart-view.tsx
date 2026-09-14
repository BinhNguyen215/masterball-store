import { AlertTriangle, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/storefront/button-link";
import { EmptyState } from "@/components/storefront/empty-state";
import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { CartLineItemViewModel } from "@/components/storefront/storefront-types";

type CartMutation = (formData: FormData) => Promise<void>;

type CartViewProps = {
  cartVersion?: number;
  checkoutAvailable?: boolean;
  items: CartLineItemViewModel[];
  message?: { kind: "error" | "success"; text: string };
  removeItemAction?: CartMutation;
  updateQuantityAction?: CartMutation;
};

function CartMessage({ message }: { message?: CartViewProps["message"] }) {
  if (!message) return null;

  return (
    <div className="notice" role={message.kind === "error" ? "alert" : "status"}>
      {message.kind === "error" ? (
        <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
      ) : (
        <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.8} />
      )}
      <p>{message.text}</p>
    </div>
  );
}

export function CartView({
  cartVersion,
  checkoutAvailable = false,
  items,
  message,
  removeItemAction,
  updateQuantityAction,
}: CartViewProps) {
  if (items.length === 0) {
    return (
      <>
        <CartMessage message={message} />
        <EmptyState
          actionHref="/products"
          actionLabel="Khám phá sản phẩm"
          description="Giỏ hàng chưa có sản phẩm. Giá và tồn kho sẽ được kiểm tra lại khi bạn thêm hàng từ catalog."
          icon={ShoppingBag}
          title="Giỏ hàng đang trống"
        />
      </>
    );
  }

  const subtotal = items.reduce(
    (total, item) => total + item.unitPriceVnd * item.quantity,
    0,
  );

  return (
    <div className="cart-layout">
      <section aria-labelledby="cart-items-title">
        <CartMessage message={message} />
        <h2 id="cart-items-title" className="sr-only">
          Sản phẩm trong giỏ
        </h2>
        <ul className="cart-items">
          {items.map((item) => (
            <li className="cart-item" key={item.lineId}>
              <div className="cart-item-media">
                {item.image ? (
                  <Image
                    alt={item.image.alt}
                    fill
                    sizes="8rem"
                    src={item.image.src}
                  />
                ) : (
                  <span aria-hidden="true" className="capture-mark" />
                )}
              </div>
              <div className="cart-item-copy">
                <Link href={`/products/${item.productSlug}`}>{item.productName}</Link>
                <span>{item.variantLabel}</span>
                <span className="price">{formatVnd(item.unitPriceVnd)}</span>
                {item.warning ? (
                  <p className="cart-warning" role="status">
                    <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.8} />
                    {item.warning}
                  </p>
                ) : null}
              </div>
              <div className="cart-item-actions">
                <form action={updateQuantityAction}>
                  <input name="variantId" type="hidden" value={item.variantId} />
                  <input name="expectedVersion" type="hidden" value={cartVersion} />
                  <label className="field-label" htmlFor={`quantity-${item.lineId}`}>
                    Số lượng
                  </label>
                  <input
                    defaultValue={item.quantity}
                    disabled={!updateQuantityAction}
                    id={`quantity-${item.lineId}`}
                    inputMode="numeric"
                    max="99"
                    min="1"
                    name="quantity"
                    type="number"
                  />
                  <button
                    className="button button--secondary"
                    disabled={!updateQuantityAction}
                    type="submit"
                  >
                    Cập nhật
                  </button>
                </form>
                <form action={removeItemAction}>
                  <input name="variantId" type="hidden" value={item.variantId} />
                  <input name="expectedVersion" type="hidden" value={cartVersion} />
                  <button
                    className="button button--secondary"
                    disabled={!removeItemAction}
                    type="submit"
                  >
                    <Trash2 aria-hidden="true" size={18} strokeWidth={1.8} />
                    Xóa
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <aside aria-labelledby="cart-summary-title" className="summary-panel">
        <h2 id="cart-summary-title">Tóm tắt giỏ hàng</h2>
        <dl className="order-summary-list">
          <div className="order-summary-row">
            <dt>Tạm tính</dt>
            <dd>{formatVnd(subtotal)}</dd>
          </div>
          <div className="order-summary-row">
            <dt>Phí giao hàng</dt>
            <dd>Xác nhận khi thanh toán</dd>
          </div>
        </dl>
        {checkoutAvailable ? (
          <ButtonLink href="/checkout">Tiến hành thanh toán</ButtonLink>
        ) : (
          <div className="notice" role="status">
            <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
            <p>Chưa thể thanh toán vì giỏ hàng có sản phẩm hết hoặc thiếu tồn kho.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
