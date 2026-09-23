import { z } from "zod";

import type { OrderStatusViewModel } from "@/components/storefront/storefront-types";
import type { StorefrontCopy } from "@/i18n";

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
    default:
      return copy.statusFallback;
  }
}

export function mapOrderForStorefront(
  order: StorefrontOrder,
  copy: OrderCopy,
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
    shippingVnd: order.shippingVnd,
    statusLabel: orderStatusLabel(order.orderStatus, copy),
    subtotalVnd: order.subtotalVnd,
    totalVnd: order.totalVnd,
  };
}
