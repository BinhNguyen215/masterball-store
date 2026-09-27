import "server-only";

import { readCartToken } from "@/app/(store)/cart/cart-cookie";
import { getCartItemCount } from "@/modules/cart";

/**
 * Units in the visitor's cart, for the header badge. Returns 0 when the
 * deployment has no database, the visitor has no cart cookie, or the cookie no
 * longer resolves — the badge is decoration and must never break a page.
 */
export async function readCartItemCount(): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) return 0;
  const token = await readCartToken();
  if (!token) return 0;
  try {
    return await getCartItemCount(token);
  } catch {
    return 0;
  }
}
