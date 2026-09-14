"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";

import { CartError, createCart, getCart, setCartItem } from "@/modules/cart";

import { readCartToken, writeCartToken } from "../../cart/cart-cookie";
import {
  getAddedCartQuantity,
  parseAddToCartForm,
  ProductCartFormError,
} from "./product-commerce";

const productSlugSchema = z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function addToCartErrorCode(error: unknown): string {
  if (error instanceof ZodError || error instanceof ProductCartFormError) {
    return "invalid";
  }
  if (error instanceof CartError) {
    switch (error.code) {
      case "INSUFFICIENT_STOCK":
        return "stock";
      case "VARIANT_UNAVAILABLE":
      case "CART_NOT_ACTIVE":
      case "INVALID_TOKEN":
        return "unavailable";
      case "VERSION_CONFLICT":
        return "changed";
    }
  }
  return "service";
}

export async function addProductVariantToCart(
  productSlug: string,
  formData: FormData,
): Promise<void> {
  let productPath = "/products";
  let destination: string;

  try {
    const safeSlug = productSlugSchema.parse(productSlug);
    productPath = `/products/${safeSlug}`;
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error("Storefront database is unavailable.");
    }

    const input = parseAddToCartForm(formData);
    let token = await readCartToken();
    let version: number | undefined;
    let currentQuantity = 0;
    let needsNewCart = !token;

    if (token) {
      try {
        const cart = await getCart(token);
        needsNewCart =
          cart.status !== "ACTIVE" || cart.expiresAt.getTime() <= Date.now();
        if (!needsNewCart) {
          version = cart.version;
          currentQuantity =
            cart.items.find((item) => item.variantId === input.variantId)
              ?.quantity ?? 0;
        }
      } catch (error) {
        if (error instanceof CartError && error.code === "INVALID_TOKEN") {
          needsNewCart = true;
        } else {
          throw error;
        }
      }
    }

    if (needsNewCart) {
      const cart = await createCart();
      token = cart.token;
      version = cart.version;
      await writeCartToken(cart.token, cart.expiresAt);
    }

    if (!token || version === undefined) {
      throw new Error("Cart could not be initialized.");
    }

    await setCartItem({
      expectedVersion: version,
      quantity: getAddedCartQuantity(currentQuantity, input.quantity),
      token,
      variantId: input.variantId,
    });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    revalidatePath(productPath);
    destination = `${productPath}?cart=added`;
  } catch (error) {
    destination = `${productPath}?error=${addToCartErrorCode(error)}`;
  }

  redirect(destination);
}
