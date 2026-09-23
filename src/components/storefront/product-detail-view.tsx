import { AlertTriangle, PackageSearch, ShoppingBag } from "lucide-react";
import Image from "next/image";

import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { EmptyState } from "@/components/storefront/empty-state";
import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { ProductDetailViewModel } from "@/components/storefront/storefront-types";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type AddToCartAction = (formData: FormData) => Promise<void>;

type ProductDetailViewProps = {
  addToCartAction?: AddToCartAction;
  cartMessage?: { kind: "error" | "success"; text: string };
  product: ProductDetailViewModel | null;
};

export async function ProductDetailView({
  addToCartAction,
  cartMessage,
  product,
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
    <div className="section-inner">
      <Breadcrumb
        items={[
          { href: "/", label: copy.chrome.breadcrumb.home },
          { href: "/products", label: copy.chrome.nav.products },
          { label: product.name },
        ]}
      />
      <article className="product-detail">
        <div className="product-gallery">
          {product.image ? (
            <Image
              alt={product.image.alt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 58vw"
              src={product.image.src}
            />
          ) : (
            <span aria-hidden="true" className="capture-mark hero-capture" />
          )}
        </div>
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
          {addToCartAction ? (
            <form action={addToCartAction} className="filter-form">
              <div className="field">
                <label className="field-label" htmlFor="product-variant">
                  {copy.product.variant}
                </label>
                <select id="product-variant" name="variantId" required>
                  <option value="">{copy.product.chooseVariant}</option>
                  {product.variants.map((variant) => (
                    <option
                      disabled={!variant.available}
                      key={variant.id}
                      value={variant.id}
                    >
                      {variant.label}
                      {variant.available ? "" : copy.product.variantOutOfStockSuffix}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="product-quantity">
                  {copy.product.quantity}
                </label>
                <input
                  defaultValue="1"
                  id="product-quantity"
                  inputMode="numeric"
                  max="99"
                  min="1"
                  name="quantity"
                  required
                  type="number"
                />
              </div>
              <button className="button button--primary" type="submit">
                {copy.product.addToCart}
                <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.8} />
              </button>
            </form>
          ) : (
            <div className="notice" role="status">
              <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
              <p>{copy.product.cartDisabled}</p>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
