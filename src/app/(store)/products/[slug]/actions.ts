"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";

import { getRequestIpAddress } from "@/lib/request-ip";
import { CartError, createCart, getCart, setCartItem } from "@/modules/cart";
import { getStorefrontProductBySlug } from "@/modules/catalog/catalog-queries";
import { RestockAlertError, subscribeToRestock } from "@/modules/inventory";
import { consumeGuestRateLimit } from "@/modules/orders";
import { ReviewError, submitProductReview } from "@/modules/reviews";
import { recordRecentlyViewedSlug } from "@/components/storefront/recently-viewed-storage";

import { readCartToken, writeCartToken } from "../../cart/cart-cookie";
import {
  getAddedCartQuantity,
  parseAddToCartForm,
  ProductCartFormError,
  readProductReviewForm,
  readRestockAlertForm,
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
  const slug = productSlugSchema.safeParse(productSlug);
  if (!slug.success) redirect("/products?error=invalid");
  const productPath = `/products/${slug.data}`;
  // The throttle reads the shared rate-limit table and the cart service needs
  // the same database, so the unconfigured storefront has to bail out first.
  if (!process.env.DATABASE_URL?.trim()) redirect(`${productPath}?error=service`);

  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(await headers()),
    scope: "cart-mutation",
  });
  if (!allowed) redirect(`${productPath}?error=throttled`);

  let destination: string;

  try {
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

/**
 * Records one product visit in the recently-viewed cookie. It is invoked from a
 * client effect, so it resolves quietly instead of surfacing an error page.
 */
export async function recordProductView(productSlug: string): Promise<void> {
  const parsed = productSlugSchema.safeParse(productSlug);
  if (!parsed.success || !process.env.DATABASE_URL?.trim()) return;
  await recordRecentlyViewedSlug(parsed.data);
}

/** Maps a review failure to the query code the product page renders. */
function reviewQueryCode(error: unknown): string {
  if (error instanceof ReviewError) {
    switch (error.code) {
      case "DUPLICATE":
        return "duplicate";
      case "INVALID":
        return "invalid";
      case "NOT_FOUND":
      case "ORDER_NOT_FOUND":
        return "notfound";
    }
  }
  return "service";
}

/** Maps a restock failure to the query code the product page renders. */
function restockQueryCode(error: unknown): string {
  if (error instanceof RestockAlertError) {
    return error.code === "UNAVAILABLE" ? "unavailable" : "invalid";
  }
  return "service";
}

/**
 * Submits a purchase-verified review. The product id is resolved from the slug
 * here, so a form that posts its own product id cannot review another product.
 */
export async function submitProductReviewAction(
  productSlug: string,
  formData: FormData,
): Promise<void> {
  const slug = productSlugSchema.safeParse(productSlug);
  if (!slug.success) redirect("/products?error=invalid");
  const productPath = `/products/${slug.data}`;
  if (!process.env.DATABASE_URL?.trim()) redirect(`${productPath}?review=service`);

  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(await headers()),
    scope: "product-review",
  });
  if (!allowed) redirect(`${productPath}?review=throttled`);

  let destination: string;

  try {
    const product = await getStorefrontProductBySlug(slug.data);
    if (!product) {
      // A stale or forged slug has no product to attach the review to.
      destination = `${productPath}?review=service`;
    } else {
      await submitProductReview({
        ...readProductReviewForm(formData),
        productId: product.productId,
      });
      revalidatePath(productPath);
      destination = `${productPath}?review=recorded`;
    }
  } catch (error) {
    destination = `${productPath}?review=${reviewQueryCode(error)}`;
  }

  redirect(destination);
}

/**
 * Registers one email for one out-of-stock variant. The variant id is the form's
 * own field; the alert service proves it exists before anything is stored.
 */
export async function subscribeRestockAlertAction(
  productSlug: string,
  formData: FormData,
): Promise<void> {
  const slug = productSlugSchema.safeParse(productSlug);
  if (!slug.success) redirect("/products?error=invalid");
  const productPath = `/products/${slug.data}`;
  if (!process.env.DATABASE_URL?.trim()) redirect(`${productPath}?restock=service`);

  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(await headers()),
    scope: "restock-alert",
  });
  if (!allowed) redirect(`${productPath}?restock=throttled`);

  let destination: string;

  try {
    const { alreadySubscribed } = await subscribeToRestock(
      readRestockAlertForm(formData),
    );
    revalidatePath(productPath);
    destination = `${productPath}?restock=${
      alreadySubscribed ? "existing" : "recorded"
    }`;
  } catch (error) {
    destination = `${productPath}?restock=${restockQueryCode(error)}`;
  }

  redirect(destination);
}
