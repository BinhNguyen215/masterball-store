"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  isStorefrontTheme,
  STOREFRONT_LOCALE_MAX_AGE_SECONDS,
  STOREFRONT_THEME_COOKIE,
  type StorefrontTheme,
} from "@/i18n";

/**
 * Stores the theme the visitor asked for. The control posts the target theme
 * rather than toggling server-side, so the rendered state and the submitted
 * value can never disagree.
 */
export async function setStorefrontTheme(formData: FormData): Promise<void> {
  const requested = formData.get("theme");
  const theme: StorefrontTheme = isStorefrontTheme(requested) ? requested : "dark";

  (await cookies()).set(STOREFRONT_THEME_COOKIE, theme, {
    httpOnly: false,
    maxAge: STOREFRONT_LOCALE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
