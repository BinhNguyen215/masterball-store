import type { ReactNode } from "react";

import { readCartItemCount } from "@/components/storefront/cart-summary";
import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [locale, cartItemCount] = await Promise.all([
    readStorefrontLocale(),
    readCartItemCount(),
  ]);
  const copy = getStorefrontCopy(locale);

  return (
    <div className="site-shell" lang={locale}>
      <a className="skip-link" href="#main-content">
        {copy.chrome.skipLink}
      </a>
      <StoreHeader cartItemCount={cartItemCount} copy={copy.chrome} locale={locale} />
      <main className="store-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <StoreFooter copy={copy.chrome} />
    </div>
  );
}
