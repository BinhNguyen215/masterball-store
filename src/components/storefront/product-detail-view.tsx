import { AlertTriangle, BellRing, PackageSearch, ShoppingBag } from "lucide-react";

import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { EmptyState } from "@/components/storefront/empty-state";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchaseForm } from "@/components/storefront/product-purchase-form";
import { ProductRail } from "@/components/storefront/product-rail";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { formatVnd } from "@/components/storefront/storefront-formatters";
import type {
  ProductDetailViewModel,
  ProductReviewSummaryViewModel,
  ProductViewModel,
} from "@/components/storefront/storefront-types";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type AddToCartAction = (formData: FormData) => Promise<void>;

type ProductNotice = { kind: "error" | "success"; text: string };

type ProductDetailViewProps = {
  addToCartAction?: AddToCartAction;
  cartMessage?: ProductNotice;
  product: ProductDetailViewModel | null;
  recentlyViewed?: ProductViewModel[];
  related?: ProductViewModel[];
  restockAction?: AddToCartAction;
  restockMessage?: ProductNotice;
  reviewAction?: AddToCartAction;
  reviewMessage?: ProductNotice;
  reviews: ProductReviewSummaryViewModel;
};

export async function ProductDetailView({
  addToCartAction,
  cartMessage,
  product,
  recentlyViewed = [],
  related = [],
  restockAction,
  restockMessage,
  reviewAction,
  reviewMessage,
  reviews,
}: ProductDetailViewProps) {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);

  if (!product) {
    return (
      <div className="section-inner">
        <EmptyState
          actionHref="/products"
          actionLabel={copy.chrome.actions.backToCatalog}
          description={copy.product.unavailableDescription}
          icon={PackageSearch}
          title={copy.product.unavailableTitle}
        />
      </div>
    );
  }

  return (
    <>
      <div className="section-inner">
        <Breadcrumb
          items={[
            { href: "/", label: copy.chrome.breadcrumb.home },
            { href: "/products", label: copy.chrome.nav.products },
            { label: product.name },
          ]}
        />
        <article className="product-detail">
          <ProductGallery
            fallback={product.image}
            images={product.images}
            labels={{
              label: copy.product.galleryLabel,
              thumbnail: copy.product.galleryThumbnail,
            }}
          />
          <div className="product-summary">
            <p className="meta-label">{product.game}</p>
            <h1>{product.name}</h1>
            <span className="price">{formatVnd(product.priceVnd, locale)}</span>
            <p className="product-description">{product.description}</p>
            <dl className="spec-list">
              <div className="spec-row">
                <dt>{copy.product.sku}</dt>
                <dd>{product.sku}</dd>
              </div>
              <div className="spec-row">
                <dt>{copy.product.type}</dt>
                <dd>{product.productType}</dd>
              </div>
              <div className="spec-row">
                <dt>{copy.product.availability}</dt>
                <dd>{product.stockLabel}</dd>
              </div>
            </dl>
            {cartMessage ? (
              <div className="notice" role={cartMessage.kind === "error" ? "alert" : "status"}>
                {cartMessage.kind === "error" ? (
                  <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
                ) : (
                  <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.8} />
                )}
                <p>{cartMessage.text}</p>
              </div>
            ) : null}
            {restockMessage ? (
              <div
                className="notice"
                role={restockMessage.kind === "error" ? "alert" : "status"}
              >
                {restockMessage.kind === "error" ? (
                  <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
                ) : (
                  <BellRing aria-hidden="true" size={20} strokeWidth={1.8} />
                )}
                <p>{restockMessage.text}</p>
              </div>
            ) : null}
            {addToCartAction ? (
              <ProductPurchaseForm
                addToCartAction={addToCartAction}
                copy={copy.product}
                restockAction={restockAction}
                restockCopy={copy.restock}
                variants={product.variants}
              />
            ) : (
              <div className="notice" role="status">
                <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
                <p>{copy.product.cartDisabled}</p>
              </div>
            )}
          </div>
        </article>
        <ProductReviews
          action={reviewAction}
          copy={copy.reviews}
          locale={locale}
          message={reviewMessage}
          reviews={reviews}
        />
      </div>
      <ProductRail
        heading={copy.product.relatedTitle}
        headingId="product-related-title"
        products={related}
      />
      <ProductRail
        heading={copy.product.recentlyViewedTitle}
        headingId="product-recently-viewed-title"
        products={recentlyViewed}
      />
    </>
  );
}
