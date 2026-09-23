"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  isStorefrontLocale,
  STOREFRONT_LOCALE_COOKIE,
  STOREFRONT_LOCALE_MAX_AGE_SECONDS,
} from "@/i18n";

export async function setStorefrontLocale(formData: FormData): Promise<void> {
  const requested = formData.get("locale");
  const locale = isStorefrontLocale(requested) ? requested : "vi";

  (await cookies()).set(STOREFRONT_LOCALE_COOKIE, locale, {
    httpOnly: false,
    maxAge: STOREFRONT_LOCALE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
