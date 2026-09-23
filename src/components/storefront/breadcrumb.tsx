import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type BreadcrumbItem = {
  href?: string;
  label: string;
};

export async function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const copy = getStorefrontCopy(await readStorefrontLocale()).chrome;

  return (
    <nav aria-label={copy.breadcrumb.aria} className="breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
            ) : null}
            {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
