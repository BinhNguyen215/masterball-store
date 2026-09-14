import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/storefront/page-intro";
import {
  ProductFilterForm,
  type ProductFilterValues,
} from "@/components/storefront/product-filter-form";
import { ProductGrid } from "@/components/storefront/product-grid";
import { loadStorefrontProductList } from "@/components/storefront/storefront-data";

export const metadata: Metadata = {
  title: "Sản phẩm TCG",
  description:
    "Tìm sản phẩm TCG và phụ kiện theo trò chơi, loại sản phẩm, tình trạng và khoảng giá.",
  alternates: { canonical: "/products" },
};

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
  const rawSearchParams = await searchParams;
  const filters = readFilters(rawSearchParams);
  const hasFilters = Object.values(filters).some(
    (value) => value && value !== "featured",
  );
  const { configured, hasNextPage, products } = await loadStorefrontProductList(filters);
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
        breadcrumbLabel="Sản phẩm"
        description="Bộ lọc nằm trong URL để bạn có thể lưu, chia sẻ và quay lại đúng kết quả đã chọn."
        title="Tìm đúng lá bài cho cuộc chơi"
      />
      <div className="section-inner catalog-layout">
        <aside aria-label="Bộ lọc sản phẩm" className="filter-panel">
          <h2>Lọc catalog</h2>
          <ProductFilterForm values={filters} />
        </aside>
        <section aria-labelledby="catalog-results-title">
          <div className="catalog-results-header">
            <h2 id="catalog-results-title">Kết quả</h2>
            <span aria-live="polite" className="result-count">
              {products.length} sản phẩm
            </span>
          </div>
          <ProductGrid
            emptyDescription={
              !configured
                ? "Catalog chưa được kết nối với cơ sở dữ liệu. Không có sản phẩm mẫu hay giá tạm được hiển thị."
                : hasFilters
                ? "Chưa có sản phẩm đã xuất bản phù hợp. Hãy thay đổi hoặc xóa bộ lọc để thử lại."
                : undefined
            }
            products={products}
          />
          {page > 1 || hasNextPage ? (
            <nav className="catalog-pagination" aria-label="Phân trang catalog">
              {page > 1 ? (
                <Link className="button-link button-link--secondary" href={pageHref(page - 1)}>
                  Trang trước
                </Link>
              ) : <span />}
              <span aria-current="page">Trang {page}</span>
              {hasNextPage ? (
                <Link className="button-link button-link--secondary" href={pageHref(page + 1)}>
                  Trang sau
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </section>
      </div>
    </>
  );
}
