import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/storefront/page-intro";
import {
  ProductFilterForm,
  type ProductFilterValues,
} from "@/components/storefront/product-filter-form";
import { ProductGrid } from "@/components/storefront/product-grid";
import { loadStorefrontProductList } from "@/components/storefront/storefront-data";
import { formatCopy, getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).catalog;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: "/products" },
  };
}

type ProductSearchParams = {
  availability?: string | string[];
  condition?: string | string[];
  game?: string | string[];
  language?: string | string[];
  maxPrice?: string | string[];
  minPrice?: string | string[];
  page?: string | string[];
  query?: string | string[];
  set?: string | string[];
  sort?: string | string[];
  type?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readFilters(params: ProductSearchParams): ProductFilterValues {
  return {
    availability: firstValue(params.availability),
    condition: firstValue(params.condition),
    game: firstValue(params.game),
    language: firstValue(params.language),
    maxPrice: firstValue(params.maxPrice),
    minPrice: firstValue(params.minPrice),
    page: firstValue(params.page),
    query: firstValue(params.query),
    set: firstValue(params.set),
    sort: firstValue(params.sort),
    type: firstValue(params.type),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>;
}) {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);
  const catalog = copy.catalog;
  const rawSearchParams = await searchParams;
  const filters = readFilters(rawSearchParams);
  const hasFilters = Object.values(filters).some(
    (value) => value && value !== "featured",
  );
  const { configured, hasNextPage, products } = await loadStorefrontProductList(
    filters,
    locale,
  );
  const page = Math.max(1, Number(filters.page) || 1);
  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(rawSearchParams)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined) query.append(key, item);
      }
    }
    query.set("page", String(targetPage));
    return `/products?${query.toString()}`;
  };

  return (
    <>
      <PageIntro
        breadcrumbLabel={catalog.breadcrumb}
        description={catalog.introDescription}
        title={catalog.introTitle}
      />
      <div className="section-inner catalog-layout">
        <aside aria-label={catalog.filtersAria} className="filter-panel">
          <h2>{catalog.filtersHeading}</h2>
          <ProductFilterForm
            copy={catalog.filters}
            typeLabels={catalog.productType}
            values={filters}
          />
        </aside>
        <section aria-labelledby="catalog-results-title">
          <div className="catalog-results-header">
            <h2 id="catalog-results-title">{catalog.resultsHeading}</h2>
            <span aria-live="polite" className="result-count">
              {formatCopy(catalog.resultsCount, { count: products.length })}
            </span>
          </div>
          <ProductGrid
            emptyDescription={
              !configured
                ? catalog.empty.unconfigured
                : hasFilters
                ? catalog.empty.filtered
                : undefined
            }
            products={products}
          />
          {page > 1 || hasNextPage ? (
            <nav className="catalog-pagination" aria-label={catalog.paginationAria}>
              {page > 1 ? (
                <Link className="button-link button-link--secondary" href={pageHref(page - 1)}>
                  {copy.chrome.actions.previousPage}
                </Link>
              ) : <span />}
              <span aria-current="page">
                {formatCopy(catalog.pageIndicator, { page })}
              </span>
              {hasNextPage ? (
                <Link className="button-link button-link--secondary" href={pageHref(page + 1)}>
                  {copy.chrome.actions.nextPage}
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </section>
      </div>
    </>
  );
}
