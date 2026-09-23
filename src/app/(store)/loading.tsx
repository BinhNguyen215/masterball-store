import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export default async function StoreLoading() {
  const copy = getStorefrontCopy(await readStorefrontLocale());

  return (
    <div aria-busy="true" aria-live="polite" className="section-inner skeleton-stack">
      <span className="sr-only">{copy.chrome.status.loading}</span>
      <div aria-hidden="true" className="skeleton-line skeleton-line--short" />
      <div aria-hidden="true" className="skeleton-line" />
      <div aria-hidden="true" className="skeleton-block" />
    </div>
  );
}
