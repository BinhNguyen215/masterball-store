import { SearchX } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/storefront/button-link";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

/**
 * Root-level fallback for paths that match no route. Without it Next renders
 * its built-in English 404 inside the Vietnamese document metadata, which
 * breaks the "one language at a time" contract.
 */
export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).chrome.status;

  return { title: copy.notFoundTitle, robots: { follow: false, index: false } };
}

export default async function RootNotFound() {
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
