import { z } from "zod";

import type {
  OrderStatusViewModel,
  OrderTimelineEntry,
} from "@/components/storefront/storefront-types";
import type { StorefrontCopy } from "@/i18n";
import { readFulfillmentChoice } from "@/modules/checkout/fulfillment-choice";
import type { PickupLocation } from "@/modules/checkout/pickup-location";
import {
  buildBankTransferInstruction,
  type BankTransferConfig,
  type BankTransferInstruction,
} from "@/modules/payments/bank-transfer";

type OrderCopy = StorefrontCopy["orders"];

const lookupTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function isValidOrderLookupToken(token: string): boolean {
  return lookupTokenPattern.test(token);
}

export const orderLookupSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^MB-[0-9A-F]{20}$/),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 .-]{7,19}$/),
});

export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.slice(0, 40);
}

export function getOrderLookupMessage(
  input: {
    error?: string | string[];
  },
  copy: OrderCopy,
): { kind: "error"; text: string } | undefined {
  const error = Array.isArray(input.error) ? input.error[0] : input.error;
  switch (error) {
    case "invalid":
      return { kind: "error", text: copy.message.invalid };
    case "notfound":
      return { kind: "error", text: copy.message.notfound };
    case "throttled":
      return { kind: "error", text: copy.message.throttled };
    case "unavailable":
      return { kind: "error", text: copy.message.unavailable };
    default:
      return undefined;
  }
}

type StorefrontOrder = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  subtotalVnd: number;
  shippingVnd: number;
  discountVnd: number;
  totalVnd: number;
  trackingNumber: string | null;
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

function orderStatusLabel(status: string, copy: OrderCopy): string {
  switch (status) {
    case "CANCELLED":
      return copy.orderStatus.cancelled;
    case "COMPLETED":
      return copy.orderStatus.completed;
    case "CONFIRMED":
      return copy.orderStatus.confirmed;
    case "PENDING_PAYMENT":
      return copy.orderStatus.pendingPayment;
    default:
      return copy.statusFallback;
  }
}

function paymentStatusLabel(status: string, copy: OrderCopy): string {
  switch (status) {
    case "FAILED":
      return copy.paymentStatus.failed;
    case "MANUAL_REVIEW":
      return copy.paymentStatus.manualReview;
    case "PAID":
      return copy.paymentStatus.paid;
    case "PARTIALLY_REFUNDED":
      return copy.paymentStatus.partiallyRefunded;
    case "PENDING":
      return copy.paymentStatus.pending;
    case "REFUNDED":
      return copy.paymentStatus.refunded;
    case "UNPAID":
      return copy.paymentStatus.unpaid;
    default:
      return copy.statusFallback;
  }
}

function fulfillmentStatusLabel(status: string, copy: OrderCopy): string {
  switch (status) {
    case "DELIVERED":
      return copy.fulfillmentStatus.delivered;
    case "PROCESSING":
      return copy.fulfillmentStatus.processing;
    case "RETURNED":
      return copy.fulfillmentStatus.returned;
    case "SHIPPED":
      return copy.fulfillmentStatus.shipped;
    case "UNFULFILLED":
      return copy.fulfillmentStatus.unfulfilled;
    default:
      return copy.statusFallback;
  }
}

function paymentMethodLabel(method: string, copy: OrderCopy): string {
  switch (method) {
    case "VNPAY":
      return copy.paymentMethodVnpay;
    case "COD":
      return copy.paymentMethodCod;
    case "BANK_TRANSFER":
      return copy.paymentMethodBankTransfer;
    default:
      return copy.statusFallback;
  }
}

/**
 * The subset of `order_status_history` the customer view may show. `actorId` and
 * the free-text reason are deliberately absent: they are staff-only detail.
 */
type StorefrontOrderHistoryEntry = {
  id: string;
  dimension: string;
  toStatus: string;
  createdAt: Date;
};

const ORDER_TIMELINE_LIMIT = 20;

/**
 * Customer-facing timeline: fulfilment and order transitions only, oldest
 * first, and never longer than the page can usefully show.
 */
function mapOrderTimeline(
  history: StorefrontOrderHistoryEntry[],
  copy: OrderCopy,
): OrderTimelineEntry[] {
  return history
    .filter(
      (entry) => entry.dimension === "ORDER" || entry.dimension === "FULFILLMENT",
    )
    .slice(-ORDER_TIMELINE_LIMIT)
    .map((entry) => ({
      createdAt: entry.createdAt.toISOString(),
      dimensionLabel:
        entry.dimension === "FULFILLMENT"
          ? copy.timelineFulfillment
          : copy.timelineOrder,
      id: entry.id,
      statusLabel:
        entry.dimension === "FULFILLMENT"
          ? fulfillmentStatusLabel(entry.toStatus, copy)
          : orderStatusLabel(entry.toStatus, copy),
    }));
}

export function mapOrderForStorefront(
  order: StorefrontOrder,
  copy: OrderCopy,
  history: StorefrontOrderHistoryEntry[] = [],
): OrderStatusViewModel {
  return {
    createdAt: order.createdAt.toISOString(),
    fulfillmentStatusLabel: fulfillmentStatusLabel(order.fulfillmentStatus, copy),
    items: order.items.map((item) => ({
      lineId: item.id,
      lineTotalVnd: item.lineTotalVnd,
      productName: item.productTitle,
      quantity: item.quantity,
      unitPriceVnd: item.unitPriceVnd,
      variantLabel: item.variantSku,
    })),
    paymentMethodLabel: paymentMethodLabel(order.paymentMethod, copy),
    paymentStatusLabel: paymentStatusLabel(order.paymentStatus, copy),
    reference: order.orderNumber,
    discountVnd: order.discountVnd,
    shippingVnd: order.shippingVnd,
    statusLabel: orderStatusLabel(order.orderStatus, copy),
    subtotalVnd: order.subtotalVnd,
    timeline: mapOrderTimeline(history, copy),
    totalVnd: order.totalVnd,
    trackingNumber: order.trackingNumber?.trim() || null,
  };
}

/**
 * The status-page facts that are not columns on the order: the transfer details
 * while a bank transfer still awaits payment, and the shop address when the
 * order is collected instead of delivered.
 */
export type OrderStatusExtras = {
  bankTransfer: BankTransferInstruction | null;
  pickup: PickupLocation | null;
};

export function buildOrderStatusExtras(input: {
  order: {
    customerNote: string | null;
    orderNumber: string;
    paymentMethod: string;
    paymentStatus: string;
    totalVnd: number;
  };
  bankTransferConfig: BankTransferConfig | null;
  pickupLocation: PickupLocation | null;
}): OrderStatusExtras {
  const pickup =
    input.pickupLocation &&
    readFulfillmentChoice({ customerNote: input.order.customerNote }) === "PICKUP"
      ? input.pickupLocation
      : null;
  const bankTransfer =
    input.order.paymentMethod === "BANK_TRANSFER" &&
    input.order.paymentStatus === "PENDING"
      ? buildBankTransferInstruction({
          amountVnd: input.order.totalVnd,
          config: input.bankTransferConfig,
          orderNumber: input.order.orderNumber,
        })
      : null;
  return { bankTransfer, pickup };
}
