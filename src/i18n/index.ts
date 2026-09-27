import { chromeCopy } from "./copy/chrome";
import { accountCopy } from "./copy/account";
import { homeCopy } from "./copy/home";
import { catalogCopy } from "./copy/catalog";
import { couponsCopy } from "./copy/coupons";
import { productCopy } from "./copy/product";
import { checkoutCopy } from "./copy/checkout";
import { ordersCopy } from "./copy/orders";
import { policiesCopy } from "./copy/policies";
import { registrationsCopy } from "./copy/registrations";
import { restockCopy } from "./copy/restock";
import { reviewsCopy } from "./copy/reviews";
import { tournamentsCopy } from "./copy/tournaments";
import type { StorefrontLocale } from "./storefront";

export * from "./storefront";

const storefrontCopy = {
  vi: {
    chrome: chromeCopy.vi,
    account: accountCopy.vi,
    home: homeCopy.vi,
    catalog: catalogCopy.vi,
    coupons: couponsCopy.vi,
    product: productCopy.vi,
    checkout: checkoutCopy.vi,
    orders: ordersCopy.vi,
    policies: policiesCopy.vi,
    registrations: registrationsCopy.vi,
    restock: restockCopy.vi,
    reviews: reviewsCopy.vi,
    tournaments: tournamentsCopy.vi,
  },
  en: {
    chrome: chromeCopy.en,
    account: accountCopy.en,
    home: homeCopy.en,
    catalog: catalogCopy.en,
    coupons: couponsCopy.en,
    product: productCopy.en,
    checkout: checkoutCopy.en,
    orders: ordersCopy.en,
    policies: policiesCopy.en,
    registrations: registrationsCopy.en,
    restock: restockCopy.en,
    reviews: reviewsCopy.en,
    tournaments: tournamentsCopy.en,
  },
} as const;

export type StorefrontCopy = (typeof storefrontCopy)["vi"];

export function getStorefrontCopy(locale: StorefrontLocale): StorefrontCopy {
  return locale === "en" ? storefrontCopy.en : storefrontCopy.vi;
}
