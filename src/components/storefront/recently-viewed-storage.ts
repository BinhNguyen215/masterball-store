import "server-only";

import { cookies } from "next/headers";

import {
  parseRecentlyViewedSlugs,
  RECENTLY_VIEWED_COOKIE_NAME,
  RECENTLY_VIEWED_MAX_AGE_SECONDS,
  rememberViewedSlug,
  serializeRecentlyViewedSlugs,
} from "@/components/storefront/recently-viewed";

export async function readRecentlyViewedSlugs(): Promise<string[]> {
  const value = (await cookies()).get(RECENTLY_VIEWED_COOKIE_NAME)?.value;
  return parseRecentlyViewedSlugs(value);
}

/**
 * Records one product view. Only callable from a Server Action or route handler,
 * because the cookie is written on the response.
 */
export async function recordRecentlyViewedSlug(slug: string): Promise<void> {
  const next = rememberViewedSlug(await readRecentlyViewedSlugs(), slug);
  if (!next.length) return;

  (await cookies()).set(
    RECENTLY_VIEWED_COOKIE_NAME,
    serializeRecentlyViewedSlugs(next),
    {
      httpOnly: false,
      maxAge: RECENTLY_VIEWED_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}
