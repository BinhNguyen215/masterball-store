import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  cartItems,
  carts,
  inventories,
  orderAddresses,
  orderItems,
  orders,
  payments,
  productVariants,
  products,
} from "@/db/schema";
import { requireCartTokenHash } from "@/modules/cart";
import { enqueueEmail } from "@/modules/email";
import { reserveInventory } from "@/modules/inventory";
import {
  createOrderIdentity,
  hashIdempotencyKey,
} from "@/modules/orders/order-token";

import {
  checkoutInputSchema,
  type CheckoutAddress,
  type CheckoutInput,
} from "./checkout-schema";

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CART_NOT_FOUND"
      | "CART_NOT_ACTIVE"
      | "CART_VERSION_CONFLICT"
      | "EMPTY_CART"
      | "VARIANT_UNAVAILABLE"
      | "INVALID_SHIPPING_FEE"
      | "ORDER_TOTAL_TOO_LARGE",
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type ShippingQuoteItem = {
  variantId: string;
  quantity: number;
  weightGram: number;
  lineTotalVnd: number;
};

/**
 * Permanent guest link to the order page. Returns null when the deployment has
 * no public base URL, so the confirmation email never carries a broken link.
 */
export function orderStatusUrl(lookupToken: string): string | null {
  const base = (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s]+$/.test(base)) return null;
  return `${base}/orders/${lookupToken}`;
}

export type ShippingPolicy = (
  address: CheckoutAddress,
  items: ShippingQuoteItem[],
) => number | Promise<number>;

export class CheckoutService {
  constructor(
    private readonly shippingPolicy: ShippingPolicy,
    private readonly reservationTtlMinutes = 15,
  ) {}

  async createOrder(rawInput: CheckoutInput) {
    const input = checkoutInputSchema.parse(rawInput);
    const cartTokenHash = requireCartTokenHash(input.cartToken);
    const idempotencyHash = hashIdempotencyKey(input.idempotencyKey);
    const identity = createOrderIdentity(input.idempotencyKey);

    return getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${idempotencyHash}, 0))`,
      );

      const [existing] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          orderStatus: orders.orderStatus,
          paymentStatus: orders.paymentStatus,
          totalVnd: orders.totalVnd,
          paymentMethod: orders.paymentMethod,
          providerReference: payments.providerReference,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .leftJoin(payments, eq(payments.orderId, orders.id))
        .where(eq(orders.checkoutIdempotencyKey, idempotencyHash))
        .limit(1);
      if (existing) return { ...existing, lookupToken: identity.lookupToken, reused: true };

      const [cart] = await tx
        .select()
        .from(carts)
        .where(eq(carts.tokenHash, cartTokenHash))
        .limit(1)
        .for("update");
      if (!cart) throw new CheckoutError("Cart was not found.", "CART_NOT_FOUND");
      if (cart.status !== "ACTIVE" || cart.expiresAt <= new Date()) {
        throw new CheckoutError("Cart is no longer active.", "CART_NOT_ACTIVE");
      }
      if (cart.version !== input.cartVersion) {
        throw new CheckoutError(
          "Cart changed after it was reviewed.",
          "CART_VERSION_CONFLICT",
        );
      }

      const items = await tx
        .select({
          variantId: productVariants.id,
          sku: productVariants.sku,
          variantStatus: productVariants.status,
          language: productVariants.language,
          condition: productVariants.condition,
          edition: productVariants.edition,
          finish: productVariants.finish,
          attributes: productVariants.attributes,
          priceVnd: productVariants.priceVnd,
          weightGram: productVariants.weightGram,
          productTitle: products.title,
          productStatus: products.status,
          quantity: cartItems.quantity,
          available: sql<number>`${inventories.onHand} - ${inventories.reserved}`,
        })
        .from(cartItems)
        .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(inventories, eq(inventories.variantId, productVariants.id))
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(productVariants.id));
      if (!items.length) throw new CheckoutError("Cart is empty.", "EMPTY_CART");
      for (const item of items) {
        if (
          item.productStatus !== "ACTIVE" ||
          item.variantStatus !== "ACTIVE" ||
          item.available < item.quantity
        ) {
          throw new CheckoutError(
            `Variant ${item.sku} is no longer available in the requested quantity.`,
            "VARIANT_UNAVAILABLE",
          );
        }
      }

      const quoteItems = items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        weightGram: item.weightGram,
        lineTotalVnd: item.priceVnd * item.quantity,
      }));
      const subtotalVnd = quoteItems.reduce((total, item) => total + item.lineTotalVnd, 0);
      const shippingVnd = await this.shippingPolicy(input.address, quoteItems);
      if (!Number.isInteger(shippingVnd) || shippingVnd < 0) {
        throw new CheckoutError(
          "Shipping policy returned an invalid VND amount.",
          "INVALID_SHIPPING_FEE",
        );
      }
      const totalVnd = subtotalVnd + shippingVnd;
      if (!Number.isSafeInteger(totalVnd) || totalVnd > 2_147_483_647) {
        throw new CheckoutError("Order total exceeds the supported VND range.", "ORDER_TOTAL_TOO_LARGE");
      }

      const now = new Date();
      const reservationExpiresAt =
        input.paymentMethod === "VNPAY"
          ? new Date(now.getTime() + this.reservationTtlMinutes * 60_000)
          : null;
      const orderId = randomUUID();
      const paymentPending = input.paymentMethod === "VNPAY";
      await tx.insert(orders).values({
        id: orderId,
        orderNumber: identity.orderNumber,
        lookupTokenHash: identity.lookupTokenHash,
        checkoutIdempotencyKey: idempotencyHash,
        cartId: cart.id,
        userId: cart.userId,
        orderStatus: paymentPending ? "PENDING_PAYMENT" : "CONFIRMED",
        paymentStatus: paymentPending ? "PENDING" : "UNPAID",
        paymentMethod: input.paymentMethod,
        subtotalVnd,
        shippingVnd,
        totalVnd,
        customerNote: input.customerNote ?? null,
        reservationExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(orderAddresses).values({
        orderId,
        recipientName: input.address.recipientName,
        phone: input.address.phone,
        email: input.address.email ?? null,
        line1: input.address.line1,
        line2: input.address.line2 ?? null,
        ward: input.address.ward ?? null,
        district: input.address.district,
        province: input.address.province,
      });
      await tx.insert(orderItems).values(
        items.map((item) => ({
          orderId,
          variantId: item.variantId,
          productTitle: item.productTitle,
          variantSku: item.sku,
          variantSnapshot: {
            language: item.language,
            condition: item.condition,
            edition: item.edition,
            finish: item.finish,
            attributes: item.attributes,
          },
          unitPriceVnd: item.priceVnd,
          quantity: item.quantity,
          lineTotalVnd: item.priceVnd * item.quantity,
        })),
      );
      const [payment] = await tx
        .insert(payments)
        .values({
          orderId,
          provider: input.paymentMethod,
          providerReference: paymentPending ? identity.orderNumber : null,
          status: paymentPending ? "PENDING" : "UNPAID",
          amountVnd: totalVnd,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: payments.id, providerReference: payments.providerReference });
      await reserveInventory(tx, {
        orderId,
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        expiresAt: reservationExpiresAt,
        note: `Checkout ${identity.orderNumber}`,
      });
      await tx
        .update(carts)
        .set({ status: "CONVERTED", updatedAt: now })
        .where(and(eq(carts.id, cart.id), eq(carts.status, "ACTIVE")));

      if (input.address.email) {
        const orderUrl = orderStatusUrl(identity.lookupToken);
        await enqueueEmail(tx, {
          orderId,
          deduplicationKey: `order-created:${orderId}`,
          template: "order-created",
          recipient: input.address.email,
          payload: {
            orderNumber: identity.orderNumber,
            totalVnd,
            ...(orderUrl ? { orderUrl } : {}),
          },
        });
      }
      return {
        id: orderId,
        orderNumber: identity.orderNumber,
        lookupToken: identity.lookupToken,
        orderStatus: paymentPending ? ("PENDING_PAYMENT" as const) : ("CONFIRMED" as const),
        paymentStatus: paymentPending ? ("PENDING" as const) : ("UNPAID" as const),
        paymentMethod: input.paymentMethod,
        providerReference: payment.providerReference,
        totalVnd,
        createdAt: now,
        reused: false,
      };
    });
  }
}
