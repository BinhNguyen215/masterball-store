import { PackageSearch, ReceiptText } from "lucide-react";
import Image from "next/image";

import { EmptyState } from "@/components/storefront/empty-state";
import {
  formatVietnamDateTime,
  formatVnd,
} from "@/components/storefront/storefront-formatters";
import type { OrderStatusViewModel } from "@/components/storefront/storefront-types";
import { formatCopy, type StorefrontCopy, type StorefrontLocale } from "@/i18n";
import { buildGoogleMapsSearchUrl } from "@/lib/google-maps";
import type { BankTransferInstruction } from "@/modules/payments/bank-transfer";
import type { PickupLocation } from "@/modules/checkout/pickup-location";

type OrderStatusViewProps = {
  /** Transfer details, shown while a bank-transfer order still awaits payment. */
  bankTransfer?: BankTransferInstruction | null;
  copy: StorefrontCopy;
  locale: StorefrontLocale;
  order: OrderStatusViewModel | null;
  /** Set when the order is collected at the shop instead of delivered. */
  pickup?: PickupLocation | null;
};

export function OrderStatusView({
  bankTransfer = null,
  copy,
  locale,
  order,
  pickup = null,
}: OrderStatusViewProps) {
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
      <section aria-labelledby="order-shipment-title" className="summary-panel">
        <h2 id="order-shipment-title">{orders.shipmentTitle}</h2>
        <dl className="order-summary-list">
          {pickup ? (
            <div className="order-summary-row">
              <dt>{orders.pickupTitle}</dt>
              <dd>{orders.pickupValue}</dd>
            </div>
          ) : null}
          <div className="order-summary-row">
            <dt>{orders.fulfillment}</dt>
            <dd>{order.fulfillmentStatusLabel}</dd>
          </div>
          <div className="order-summary-row">
            <dt>{orders.trackingNumber}</dt>
            <dd>{order.trackingNumber ?? orders.trackingPending}</dd>
          </div>
        </dl>
        {pickup ? (
          <p className="field-help">
            {orders.pickupNote}{" "}
            <a
              aria-label={copy.chrome.footer.addressMapLabel}
              href={buildGoogleMapsSearchUrl(pickup.address)}
              rel="noreferrer"
              target="_blank"
              title={copy.chrome.footer.addressMapLabel}
            >
              {pickup.address}
            </a>
          </p>
        ) : order.trackingNumber ? null : (
          <p className="field-help">{orders.trackingPendingNote}</p>
        )}
      </section>
      {bankTransfer ? (
        <section aria-labelledby="order-bank-transfer-title" className="summary-panel">
          <h2 id="order-bank-transfer-title">{orders.bankTransferTitle}</h2>
          <p className="field-help">{orders.bankTransferIntro}</p>
          <dl className="order-summary-list">
            <div className="order-summary-row">
              <dt>{orders.bankTransferAmount}</dt>
              <dd>{formatVnd(bankTransfer.amountVnd, locale)}</dd>
            </div>
            <div className="order-summary-row">
              <dt>{orders.bankTransferBank}</dt>
              <dd>{bankTransfer.bankId}</dd>
            </div>
            <div className="order-summary-row">
              <dt>{orders.bankTransferAccountNo}</dt>
              <dd>{bankTransfer.accountNo}</dd>
            </div>
            {bankTransfer.accountName ? (
              <div className="order-summary-row">
                <dt>{orders.bankTransferAccountName}</dt>
                <dd>{bankTransfer.accountName}</dd>
              </div>
            ) : null}
            <div className="order-summary-row">
              <dt>{orders.bankTransferContent}</dt>
              <dd>{bankTransfer.transferContent}</dd>
            </div>
          </dl>
          <Image
            alt={formatCopy(orders.bankTransferQrAlt, { reference: order.reference })}
            height={240}
            src={bankTransfer.qrImageUrl}
            unoptimized
            width={240}
          />
          <p className="field-help">
            <a href={bankTransfer.qrImageUrl} rel="noreferrer" target="_blank">
              {orders.bankTransferOpenQr}
            </a>
          </p>
        </section>
      ) : null}
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
        </dl>
        <p className="field-help">{orders.paymentNote}</p>
      </section>
      <section aria-labelledby="order-timeline-title" className="summary-panel">
        <h2 id="order-timeline-title">{orders.timelineTitle}</h2>
        {order.timeline.length === 0 ? (
          <p className="field-help">{orders.timelineEmpty}</p>
        ) : (
          <dl className="order-summary-list">
            {order.timeline.map((entry) => (
              <div className="order-summary-row" key={entry.id}>
                <dt>{entry.dimensionLabel}</dt>
                <dd>
                  {entry.statusLabel}
                  <span className="field-help">
                    {" "}
                    <time dateTime={entry.createdAt}>
                      {formatVietnamDateTime(entry.createdAt, locale)}
                    </time>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}
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
          {order.discountVnd > 0 ? (
            <div className="order-summary-row">
              <dt>{orders.discount}</dt>
              <dd>-{formatVnd(order.discountVnd, locale)}</dd>
            </div>
          ) : null}
          <div className="order-summary-row">
            <dt>{orders.total}</dt>
            <dd>{formatVnd(order.totalVnd, locale)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
