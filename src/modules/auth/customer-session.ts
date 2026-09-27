import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";

import { getDb } from "@/db";
import { carts } from "@/db/schema";
import { verifyAndHashCartToken } from "@/modules/cart/cart-token";

import { getCustomerAuth } from "./auth";
import { isCustomerRole } from "./roles";

export type CustomerSession = {
  id: string;
  email: string;
  name: string;
};

/**
 * Reads the shopper session from the customer instance. Returns `null` for a
 * staff session (a different cookie prefix, and the role guard below rejects
 * it anyway) and for the unconfigured storefront.
 */
export async function readCustomerSession(): Promise<CustomerSession | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const session = await getCustomerAuth().api.getSession({
    headers: await headers(),
  });
  if (!session || !isCustomerRole(session.user.role)) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

/**
 * Adopts the browser's guest cart for a signed-in shopper, so the items they
 * collected before signing in follow them into `/account` and checkout.
 *
 * Only an unowned (`user_id IS NULL`) active cart is claimed: a cart that
 * already belongs to another account is never reassigned, and an invalid or
 * unknown token is a silent no-op so sign-in is never blocked by the cart.
 */
export async function linkCartToCustomer(
  cartToken: string,
  userId: string,
): Promise<void> {
  const tokenHash = verifyAndHashCartToken(cartToken);
  if (!tokenHash) return;
  await getDb()
    .update(carts)
    .set({ userId, updatedAt: new Date() })
    .where(
      and(
        eq(carts.tokenHash, tokenHash),
        eq(carts.status, "ACTIVE"),
        isNull(carts.userId),
      ),
    );
}
