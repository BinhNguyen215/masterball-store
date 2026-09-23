import { PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/storefront/empty-state";
import { ProductCard } from "@/components/storefront/product-card";
import type { ProductViewModel } from "@/components/storefront/storefront-types";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type ProductGridProps = {
  emptyDescription?: string;
  products: ProductViewModel[];
};

export async function ProductGrid({
  emptyDescription,
  products,
}: ProductGridProps) {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).catalog;

  if (products.length === 0) {
    return (
      <EmptyState
        description={emptyDescription ?? copy.empty.description}
        icon={PackageOpen}
        title={copy.empty.title}
      />
    );
  }

  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard locale={locale} product={product} />
        </li>
      ))}
    </ul>
  );
}
