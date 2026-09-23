import { PackageSearch, ReceiptText } from "lucide-react";

import { EmptyState } from "@/components/storefront/empty-state";
import {
  formatVietnamDateTime,
  formatVnd,
} from "@/components/storefront/storefront-formatters";
import type { OrderStatusViewModel } from "@/components/storefront/storefront-types";
import { formatCopy, type StorefrontCopy, type StorefrontLocale } from "@/i18n";

type OrderStatusViewProps = {
  copy: StorefrontCopy;
  locale: StorefrontLocale;
  order: OrderStatusViewModel | null;
};

export function OrderStatusView({ copy, locale, order }: OrderStatusViewProps) {
  const orders = copy.orders;

  if (!order) {
    return (
      <EmptyState
        actionHref="/products"
        actionLabel={copy.chrome.actions.backToStore}
        description={orders.unavailableDescription}
        icon={PackageSearch}
        title={orders.unavailableTitle}
      />
    );
  }

  return (
    <div className="order-layout">
      <section className="summary-panel">
        <span aria-hidden="true" className="state-icon">
          <ReceiptText size={22} strokeWidth={1.8} />
        </span>
        <h2>{formatCopy(orders.orderHeading, { reference: order.reference })}</h2>
        <p>{order.statusLabel}</p>
        <p className="field-help">
          {formatCopy(orders.createdAt, {
            date: formatVietnamDateTime(order.createdAt, locale),
          })}
        </p>
      </section>
      <section aria-labelledby="order-status-title" className="summary-panel">
        <h2 id="order-status-title">{orders.currentStatus}</h2>
        <dl className="order-summary-list">
          <div className="order-summary-row">
            <dt>{orders.paymentMethod}</dt>
            <dd>{order.paymentMethodLabel}</dd>
          </div>
          <div className="order-summary-row">
            <dt>{orders.payment}</dt>
            <dd>{order.paymentStatusLabel}</dd>
          </div>
          <div className="order-summary-row">
            <dt>{orders.fulfillment}</dt>
            <dd>{order.fulfillmentStatusLabel}</dd>
          </div>
        </dl>
        <p className="field-help">{orders.paymentNote}</p>
      </section>
      <section aria-labelledby="order-items-title" className="summary-panel">
        <h2 id="order-items-title">{orders.items}</h2>
        <dl className="order-summary-list">
          {order.items.map((item) => (
            <div className="order-summary-row" key={item.lineId}>
              <dt>
                {formatCopy(orders.itemLine, {
                  name: item.productName,
                  quantity: item.quantity,
                })}
                <span className="field-help"> {item.variantLabel}</span>
              </dt>
              <dd>{formatVnd(item.lineTotalVnd, locale)}</dd>
            </div>
          ))}
          <div className="order-summary-row">
            <dt>{orders.subtotal}</dt>
            <dd>{formatVnd(order.subtotalVnd, locale)}</dd>
          </div>
          <div className="order-summary-row">
            <dt>{orders.shipping}</dt>
            <dd>{formatVnd(order.shippingVnd, locale)}</dd>
          </div>
          <div className="order-summary-row">
            <dt>{orders.total}</dt>
            <dd>{formatVnd(order.totalVnd, locale)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
