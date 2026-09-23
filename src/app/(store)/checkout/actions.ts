"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { getPaymentEnvironment } from "@/config/environment";
import { getRequestIpAddress } from "@/lib/request-ip";
import { CartError } from "@/modules/cart";
import { CheckoutError, CheckoutService, getVietnamShippingFee } from "@/modules/checkout";
import { buildVnpayPaymentUrl, type VnpayConfig } from "@/modules/payments";

import { clearCartToken, readCartToken } from "../cart/cart-cookie";
import {
  createCheckoutIdempotencyKey,
  parseCheckoutForm,
} from "./checkout-commerce";

function checkoutErrorCode(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.some((issue) => issue.path[0] === "acceptTerms")
      ? "consent"
      : "invalid";
  }
  if (error instanceof CartError) return "cart";
  if (error instanceof CheckoutError) {
    switch (error.code) {
      case "CART_VERSION_CONFLICT":
        return "changed";
      case "EMPTY_CART":
      case "CART_NOT_ACTIVE":
      case "CART_NOT_FOUND":
        return "cart";
      case "VARIANT_UNAVAILABLE":
        return "stock";
      case "INVALID_SHIPPING_FEE":
      case "ORDER_TOTAL_TOO_LARGE":
        return "service";
    }
  }
  return "service";
}

function vnpayConfigFromEnvironment(): VnpayConfig {
  const environment = getPaymentEnvironment();
  return {
    hashSecret: environment.VNPAY_HASH_SECRET,
    paymentUrl: environment.VNPAY_PAYMENT_URL,
    returnUrl: environment.VNPAY_RETURN_URL,
    tmnCode: environment.VNPAY_TMN_CODE,
    apiUrl: environment.VNPAY_API_URL,
  };
}

async function getCheckoutIpAddress(): Promise<string> {
  return getRequestIpAddress(await headers());
}

export async function createCheckoutOrder(formData: FormData): Promise<void> {
  let destination: string;

  try {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error("Storefront database is unavailable.");
    }
    const input = parseCheckoutForm(formData);
    const cartToken = await readCartToken();
    if (!cartToken) throw new CartError("Cart token is missing.", "INVALID_TOKEN");

    const vnpayConfig =
      input.paymentMethod === "VNPAY" ? vnpayConfigFromEnvironment() : null;
    const checkout = new CheckoutService(getVietnamShippingFee);
    const order = await checkout.createOrder({
      address: input.address,
      cartToken,
      cartVersion: input.cartVersion,
      customerNote: input.customerNote,
      idempotencyKey: createCheckoutIdempotencyKey(
        cartToken,
        input.cartVersion,
      ),
      paymentMethod: input.paymentMethod,
    });

    if (order.paymentMethod === "VNPAY") {
      if (order.reused && order.paymentStatus !== "PENDING") {
        destination = `/orders/${order.lookupToken}`;
      } else {
        if (!vnpayConfig || !order.providerReference) {
          throw new Error("VNPAY payment reference is unavailable.");
        }
        destination = buildVnpayPaymentUrl({
          amountVnd: order.totalVnd,
          config: vnpayConfig,
          createdAt: order.createdAt,
          ipAddress: await getCheckoutIpAddress(),
          orderInfo: `Thanh toan don hang ${order.orderNumber}`,
          transactionReference: order.providerReference,
        });
      }
    } else {
      destination = `/orders/${order.lookupToken}`;
    }

    revalidatePath("/cart");
    revalidatePath("/checkout");
    revalidatePath(`/orders/${order.lookupToken}`);
    await clearCartToken();
  } catch (error) {
    const isPaymentConfigurationError =
      error instanceof Error &&
      error.message.startsWith("Invalid payment environment configuration");
    destination = `/checkout?error=${
      isPaymentConfigurationError ? "payment" : checkoutErrorCode(error)
    }`;
  }

  redirect(destination);
}
