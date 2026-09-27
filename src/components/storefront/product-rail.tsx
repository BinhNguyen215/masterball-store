import { ProductCard } from "@/components/storefront/product-card";
import type { ProductViewModel } from "@/components/storefront/storefront-types";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type ProductRailProps = {
  /** Heading id, so the section is announced with its label. */
  headingId: string;
  heading: string;
  products: ProductViewModel[];
};

/**
 * One horizontal product rail. The scroll container is focusable so the rail is
 * reachable and scrollable from the keyboard, matching the catalog markup.
 */
export async function ProductRail({ heading, headingId, products }: ProductRailProps) {
  if (products.length === 0) return null;
  const locale = await readStorefrontLocale();

  return (
    <section aria-labelledby={headingId} className="section product-rail">
      <div className="section-inner">
        <div className="section-heading">
          <h2 id={headingId}>{heading}</h2>
        </div>
        <div aria-label={heading} className="product-rail-scroll" role="group" tabIndex={0}>
          <ul className="product-rail-list">
            {products.map((product) => (
              <li key={product.slug}>
                <ProductCard locale={locale} product={product} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
