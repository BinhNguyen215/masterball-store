"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { getRequestIpAddress } from "@/lib/request-ip";
import { CartError, setCartItem } from "@/modules/cart";
import { consumeGuestRateLimit } from "@/modules/orders";

import { clearCartToken, readCartToken } from "./cart-cookie";
import { parseRemoveCartForm, parseUpdateCartForm } from "./cart-commerce";

function cartErrorCode(error: unknown): string {
  if (error instanceof ZodError) return "invalid";
  if (error instanceof CartError) {
    switch (error.code) {
      case "VERSION_CONFLICT":
        return "changed";
      case "INSUFFICIENT_STOCK":
        return "stock";
      case "VARIANT_UNAVAILABLE":
        return "unavailable";
      case "CART_NOT_ACTIVE":
      case "INVALID_TOKEN":
        return "expired";
    }
  }
  return "service";
}

async function finishCartMutation(
  mutation: () => Promise<void>,
  success: "removed" | "updated",
): Promise<never> {
  // The throttle reads the shared rate-limit table, so the database has to be
  // configured before anything else touches it.
  if (!process.env.DATABASE_URL?.trim()) redirect("/cart?error=service");

  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(await headers()),
    scope: "cart-mutation",
  });
  if (!allowed) redirect("/cart?error=throttled");

  let destination: string;

  try {
    await mutation();
    revalidatePath("/cart");
    revalidatePath("/checkout");
    destination = `/cart?status=${success}`;
  } catch (error) {
    const code = cartErrorCode(error);
    if (code === "expired") await clearCartToken();
    destination = `/cart?error=${code}`;
  }

  redirect(destination);
}

export async function updateCartItem(formData: FormData): Promise<void> {
  await finishCartMutation(async () => {
    const input = parseUpdateCartForm(formData);
    const token = await readCartToken();
    if (!token) throw new CartError("Cart token is missing.", "INVALID_TOKEN");

    await setCartItem({
      token,
      variantId: input.variantId,
      quantity: input.quantity,
      expectedVersion: input.expectedVersion,
    });
  }, "updated");
}

export async function removeCartItem(formData: FormData): Promise<void> {
  await finishCartMutation(async () => {
    const input = parseRemoveCartForm(formData);
    const token = await readCartToken();
    if (!token) throw new CartError("Cart token is missing.", "INVALID_TOKEN");

    await setCartItem({
      token,
      variantId: input.variantId,
      quantity: 0,
      expectedVersion: input.expectedVersion,
    });
  }, "removed");
}
