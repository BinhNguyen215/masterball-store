import { chromeCopy } from "./copy/chrome";
import { homeCopy } from "./copy/home";
import { catalogCopy } from "./copy/catalog";
import { productCopy } from "./copy/product";
import { checkoutCopy } from "./copy/checkout";
import { ordersCopy } from "./copy/orders";
import { tournamentsCopy } from "./copy/tournaments";
import type { StorefrontLocale } from "./storefront";

export * from "./storefront";

const storefrontCopy = {
  vi: {
    chrome: chromeCopy.vi,
    home: homeCopy.vi,
    catalog: catalogCopy.vi,
    product: productCopy.vi,
    checkout: checkoutCopy.vi,
    orders: ordersCopy.vi,
    tournaments: tournamentsCopy.vi,
  },
  en: {
    chrome: chromeCopy.en,
    home: homeCopy.en,
    catalog: catalogCopy.en,
    product: productCopy.en,
    checkout: checkoutCopy.en,
    orders: ordersCopy.en,
    tournaments: tournamentsCopy.en,
  },
} as const;

export type StorefrontCopy = (typeof storefrontCopy)["vi"];

export function getStorefrontCopy(locale: StorefrontLocale): StorefrontCopy {
  return locale === "en" ? storefrontCopy.en : storefrontCopy.vi;
}
