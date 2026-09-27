"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getRequestIpAddress } from "@/lib/request-ip";
import {
  linkCartToCustomer,
  readCustomerSession,
} from "@/modules/auth/customer-session";
import { consumeGuestRateLimit } from "@/modules/orders";

import { readCartToken } from "../cart/cart-cookie";

/**
 * Outcome of the pre-auth throttle. The browser performs the actual sign-in or
 * registration with the customer client (so Better Auth issues the session
 * cookie), but it must ask this action first: the shared `rateLimit` table is
 * the only place a fixed window survives across instances.
 */
export type CustomerAuthGate =
  | { allowed: true }
  | { allowed: false; reason: "throttled" | "unavailable" };

/**
 * One bucket (`customer-auth`) guards both sign-in and registration on purpose:
 * a credential-stuffing loop should not get a fresh budget by alternating
 * between the two forms.
 */
export async function allowCustomerAuth(): Promise<CustomerAuthGate> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { allowed: false, reason: "unavailable" };
  }
  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(await headers()),
    scope: "customer-auth",
  });
  return allowed ? { allowed: true } : { allowed: false, reason: "throttled" };
}

/**
 * Claims the browser's guest cart for the freshly signed-in shopper, then
 * refreshes the pages whose content depends on the cart. Called after the
 * customer client has set the session cookie.
 */
export async function adoptGuestCart(): Promise<void> {
  const session = await readCustomerSession();
  if (!session) return;
  const token = await readCartToken();
  if (!token) return;
  await linkCartToCustomer(token, session.id);
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/account");
}
