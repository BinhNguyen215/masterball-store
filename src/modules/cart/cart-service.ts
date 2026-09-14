import { and, asc, eq, sql } from "drizzle-orm";

import { getDb, type AppTransaction } from "@/db";
import {
  cartItems,
  carts,
  inventories,
  productVariants,
  products,
} from "@/db/schema";

import { createCartToken, verifyAndHashCartToken } from "./cart-token";

export class CartError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_TOKEN"
      | "CART_NOT_ACTIVE"
      | "VERSION_CONFLICT"
      | "VARIANT_UNAVAILABLE"
      | "INSUFFICIENT_STOCK",
  ) {
    super(message);
    this.name = "CartError";
  }
}

export async function createCart(input: { userId?: string | null; ttlDays?: number } = {}) {
  const { token, tokenHash } = createCartToken();
  const ttlDays = Math.max(1, Math.min(90, input.ttlDays ?? 30));
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  const [cart] = await getDb()
    .insert(carts)
    .values({ tokenHash, userId: input.userId ?? null, expiresAt })
    .returning({ id: carts.id, version: carts.version, expiresAt: carts.expiresAt });
  return { ...cart, token };
}

export function requireCartTokenHash(token: string): string {
  const tokenHash = verifyAndHashCartToken(token);
  if (!tokenHash) throw new CartError("Cart token is invalid.", "INVALID_TOKEN");
  return tokenHash;
}

async function lockActiveCart(tx: AppTransaction, tokenHash: string) {
  const [cart] = await tx
    .select()
    .from(carts)
    .where(eq(carts.tokenHash, tokenHash))
    .limit(1)
    .for("update");
  if (!cart) throw new CartError("Cart token is invalid.", "INVALID_TOKEN");
  if (cart.status !== "ACTIVE" || cart.expiresAt <= new Date()) {
    throw new CartError("Cart is no longer active.", "CART_NOT_ACTIVE");
  }
  return cart;
}

export async function setCartItem(input: {
  token: string;
  variantId: string;
  quantity: number;
  expectedVersion: number;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new CartError("Cart quantity must be a non-negative integer.", "VARIANT_UNAVAILABLE");
  }
  const tokenHash = requireCartTokenHash(input.token);
  return getDb().transaction(async (tx) => {
    const cart = await lockActiveCart(tx, tokenHash);
    if (cart.version !== input.expectedVersion) {
      throw new CartError("Cart was changed by another request.", "VERSION_CONFLICT");
    }

    if (input.quantity === 0) {
      await tx
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cart.id),
            eq(cartItems.variantId, input.variantId),
          ),
        );
    } else {
      const [variant] = await tx
        .select({
          priceVnd: productVariants.priceVnd,
          available: sql<number>`${inventories.onHand} - ${inventories.reserved}`,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(inventories, eq(inventories.variantId, productVariants.id))
        .where(
          and(
            eq(productVariants.id, input.variantId),
            eq(productVariants.status, "ACTIVE"),
            eq(products.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!variant) {
        throw new CartError("Variant is not available for sale.", "VARIANT_UNAVAILABLE");
      }
      if (variant.available < input.quantity) {
        throw new CartError("Requested quantity exceeds available stock.", "INSUFFICIENT_STOCK");
      }
      await tx
        .insert(cartItems)
        .values({
          cartId: cart.id,
          variantId: input.variantId,
          quantity: input.quantity,
          priceAtAddVnd: variant.priceVnd,
        })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.variantId],
          set: {
            quantity: input.quantity,
            priceAtAddVnd: variant.priceVnd,
            updatedAt: new Date(),
          },
        });
    }

    const [updated] = await tx
      .update(carts)
      .set({ version: sql`${carts.version} + 1`, updatedAt: new Date() })
      .where(eq(carts.id, cart.id))
      .returning({ version: carts.version });
    return { cartId: cart.id, version: updated.version };
  });
}

export async function getCart(token: string) {
  const tokenHash = requireCartTokenHash(token);
  const [cart] = await getDb()
    .select()
    .from(carts)
    .where(eq(carts.tokenHash, tokenHash))
    .limit(1);
  if (!cart) throw new CartError("Cart token is invalid.", "INVALID_TOKEN");

  const items = await getDb()
    .select({
      variantId: cartItems.variantId,
      productTitle: products.title,
      productSlug: products.slug,
      sku: productVariants.sku,
      quantity: cartItems.quantity,
      priceAtAddVnd: cartItems.priceAtAddVnd,
      currentPriceVnd: productVariants.priceVnd,
      available: sql<number>`${inventories.onHand} - ${inventories.reserved}`,
      sellable: sql<boolean>`${products.status} = 'ACTIVE' and ${productVariants.status} = 'ACTIVE'`,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(inventories, eq(inventories.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id));

  return {
    id: cart.id,
    version: cart.version,
    status: cart.status,
    expiresAt: cart.expiresAt,
    items: items.map((item) => ({
      ...item,
      priceChanged: item.currentPriceVnd !== item.priceAtAddVnd,
      stockChanged: !item.sellable || item.available < item.quantity,
      lineTotalVnd: item.currentPriceVnd * item.quantity,
    })),
    subtotalVnd: items.reduce(
      (total, item) => total + item.currentPriceVnd * item.quantity,
      0,
    ),
  };
}
