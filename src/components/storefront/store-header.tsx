import { BrandMark } from "@/components/storefront/brand-mark";
import { StoreNav } from "@/components/storefront/store-nav";
import type { StorefrontCopy } from "@/i18n";
import type { StorefrontLocale } from "@/i18n/storefront";

import { LocaleSwitcher } from "./locale-switcher";
import { setStorefrontLocale } from "@/app/(store)/locale-actions";

export function StoreHeader({
  cartItemCount,
  copy,
  locale,
}: {
  cartItemCount: number;
  copy: StorefrontCopy["chrome"];
  locale: StorefrontLocale;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <BrandMark />
        <StoreNav copy={copy} locale={locale} cartItemCount={cartItemCount} switcher={<LocaleSwitcher action={setStorefrontLocale} locale={locale} />} />
      </div>
    </header>
  );
}
