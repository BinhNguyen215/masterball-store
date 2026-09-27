import { BrandMark } from "@/components/storefront/brand-mark";
import { StoreNav } from "@/components/storefront/store-nav";
import { ThemeSwitch } from "@/components/storefront/theme-switch";
import type { StorefrontCopy } from "@/i18n";
import type { StorefrontLocale, StorefrontTheme } from "@/i18n/storefront";

import { LocaleSwitcher } from "./locale-switcher";
import { setStorefrontLocale } from "@/app/(store)/locale-actions";
import { setStorefrontTheme } from "@/app/(store)/theme-actions";

export function StoreHeader({
  accountLabel,
  cartItemCount,
  copy,
  locale,
  theme,
}: {
  accountLabel: string;
  cartItemCount: number;
  copy: StorefrontCopy["chrome"];
  locale: StorefrontLocale;
  theme: StorefrontTheme;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <BrandMark />
        <StoreNav
          accountLabel={accountLabel}
          cartItemCount={cartItemCount}
          copy={copy}
          locale={locale}
          localeSwitcher={
            <LocaleSwitcher action={setStorefrontLocale} locale={locale} />
          }
          themeSwitch={
            <ThemeSwitch action={setStorefrontTheme} copy={copy.theme} theme={theme} />
          }
        />
      </div>
    </header>
  );
}
