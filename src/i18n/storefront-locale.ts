import "server-only";

import { cookies } from "next/headers";

import {
  isStorefrontLocale,
  STOREFRONT_LOCALE_COOKIE,
  type StorefrontLocale,
} from "./storefront";

export async function readStorefrontLocale(): Promise<StorefrontLocale> {
  const value = (await cookies()).get(STOREFRONT_LOCALE_COOKIE)?.value;
  return isStorefrontLocale(value) ? value : "vi";
}
