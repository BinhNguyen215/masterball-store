import type { ReactNode } from "react";

import { readCartItemCount } from "@/components/storefront/cart-summary";
import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { readStorefrontTheme } from "@/i18n/storefront-theme";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [locale, theme, cartItemCount] = await Promise.all([
    readStorefrontLocale(),
    readStorefrontTheme(),
    readCartItemCount(),
  ]);
  const copy = getStorefrontCopy(locale);

  return (
    <div className="site-shell" lang={locale}>
      <a className="skip-link" href="#main-content">
        {copy.chrome.skipLink}
      </a>
      <StoreHeader
        accountLabel={copy.account.navLabel}
        cartItemCount={cartItemCount}
        copy={copy.chrome}
        locale={locale}
        theme={theme}
      />
      <main className="store-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <StoreFooter copy={copy.chrome} />
    </div>
  );
}
