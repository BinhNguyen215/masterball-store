import { SearchX } from "lucide-react";

import { ButtonLink } from "@/components/storefront/button-link";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export default async function StoreNotFound() {
  const copy = getStorefrontCopy(await readStorefrontLocale());

  return (
    <div className="section-inner">
      <section className="state-screen">
        <span aria-hidden="true" className="state-icon">
          <SearchX size={24} strokeWidth={1.8} />
        </span>
        <h1>{copy.chrome.status.notFoundTitle}</h1>
        <p>{copy.chrome.status.notFoundDescription}</p>
        <ButtonLink href="/products">{copy.chrome.actions.backToCatalog}</ButtonLink>
      </section>
    </div>
  );
}
