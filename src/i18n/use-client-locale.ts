"use client";

import { useSyncExternalStore } from "react";

import { getStorefrontCopy, type StorefrontCopy } from "@/i18n";
import { isStorefrontLocale, STOREFRONT_LOCALE_COOKIE } from "@/i18n/storefront";

/** The locale only changes through a server action, which re-renders the tree. */
const subscribeToLocaleCookie = () => () => {};

function readLocaleCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${STOREFRONT_LOCALE_COOKIE}=`))
    ?.split("=")[1];
}

function clientLocale(): StorefrontCopy {
  const value = readLocaleCookie();
  return getStorefrontCopy(isStorefrontLocale(value) ? value : "vi");
}

const defaultLocale = getStorefrontCopy("vi");

/**
 * Client-only surfaces (error boundaries, client widgets outside the server
 * tree) read the locale cookie through `useSyncExternalStore`, so the server
 * render and the hydrating render agree.
 */
export function useClientLocale(): StorefrontCopy {
  return useSyncExternalStore(subscribeToLocaleCookie, clientLocale, () => defaultLocale);
}
