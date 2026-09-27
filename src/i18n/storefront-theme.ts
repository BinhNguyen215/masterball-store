import "server-only";

import { cookies } from "next/headers";

import {
  isStorefrontTheme,
  STOREFRONT_THEME_COOKIE,
  type StorefrontTheme,
} from "./storefront";

/**
 * The visitor's chosen theme. Dark is the shop's identity and the default, so a
 * first visit never renders a palette the shop did not design for.
 */
export async function readStorefrontTheme(): Promise<StorefrontTheme> {
  const value = (await cookies()).get(STOREFRONT_THEME_COOKIE)?.value;
  return isStorefrontTheme(value) ? value : "dark";
}
