import "server-only";

import { cookies } from "next/headers";

import { createOrderAccessToken, verifyOrderAccessToken } from "@/modules/orders";

export const ORDER_ACCESS_COOKIE_NAME = "masterball_order_access";

const ORDER_ACCESS_PATH = "/orders";
const ORDER_ACCESS_TTL_MS = 30 * 60 * 1000;

/**
 * Grants the browser access to one order for a single browsing session after
 * the guest proved ownership with the order number and checkout phone number.
 */
export async function grantOrderAccess(orderId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    ORDER_ACCESS_COOKIE_NAME,
    createOrderAccessToken(orderId, { ttlMs: ORDER_ACCESS_TTL_MS }),
    {
      httpOnly: true,
      maxAge: Math.floor(ORDER_ACCESS_TTL_MS / 1000),
      path: ORDER_ACCESS_PATH,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export async function readOrderAccessOrderId(): Promise<string | null> {
  const token = (await cookies()).get(ORDER_ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyOrderAccessToken(token)?.orderId ?? null;
}

export async function clearOrderAccess(): Promise<void> {
  (await cookies()).delete({ name: ORDER_ACCESS_COOKIE_NAME, path: ORDER_ACCESS_PATH });
}
