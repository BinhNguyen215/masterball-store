import { CircleCheck, CircleOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { ProductViewModel } from "@/components/storefront/storefront-types";
import { getStorefrontCopy, type StorefrontLocale } from "@/i18n";

type ProductCardProps = {
  locale: StorefrontLocale;
  product: ProductViewModel;
};

export function ProductCard({ locale, product }: ProductCardProps) {
  const copy = getStorefrontCopy(locale).catalog.card;
  const AvailabilityIcon = product.available ? CircleCheck : CircleOff;

  return (
    <article className="product-card">
      <div className="product-card-media">
        {product.image ? (
          <Image
            alt={product.image.alt || copy.imageAlt}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
            src={product.image.src}
          />
        ) : (
          <span aria-hidden="true" className="capture-mark hero-capture" />
        )}
      </div>
      <div className="product-card-body">
        <p className="product-card-meta">
          {product.game} · {product.productType}
        </p>
        <h2 className="product-card-title">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h2>
        <span className="price">{formatVnd(product.priceVnd, locale)}</span>
        <span className="availability">
          <AvailabilityIcon aria-hidden="true" size={16} strokeWidth={1.8} />
          {product.available ? copy.available : copy.outOfStock}
        </span>
      </div>
    </article>
  );
}
