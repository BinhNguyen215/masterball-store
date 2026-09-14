import "server-only";

import { cookies } from "next/headers";

export const CART_COOKIE_NAME = "masterball_cart";

export async function readCartToken(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE_NAME)?.value ?? null;
}

export function getCartCookieOptions(expires: Date) {
  return {
    expires,
    httpOnly: true,
    path: "/" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function writeCartToken(token: string, expires: Date): Promise<void> {
  (await cookies()).set(CART_COOKIE_NAME, token, getCartCookieOptions(expires));
}

export async function clearCartToken(): Promise<void> {
  (await cookies()).delete(CART_COOKIE_NAME);
}
