import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { loadStorefrontProduct } from "@/components/storefront/storefront-data";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

import { addProductVariantToCart } from "./actions";
import { getProductCartMessage } from "./product-commerce";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).product;
  const { product } = await loadStorefrontProduct(slug, locale);

  if (!product) {
    return {
      title: copy.unavailableTitle,
      description: copy.metaDescription,
      robots: { follow: false, index: false },
    };
  }

  return {
    alternates: { canonical: `/products/${product.slug}` },
    description: product.description,
    title: product.name,
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    cart?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);
  const { configured, product } = await loadStorefrontProduct(slug, locale);

  if (configured && !product) {
    notFound();
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const jsonLd =
    product && origin
      ? {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Product",
              description: product.description,
              image: product.image ? [product.image.src] : undefined,
              name: product.name,
              offers: {
                "@type": "Offer",
                availability: product.available
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
                price: product.priceVnd,
                priceCurrency: "VND",
                url: `${origin}/products/${product.slug}`,
              },
              sku: product.sku,
              url: `${origin}/products/${product.slug}`,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  item: origin,
                  name: copy.chrome.breadcrumb.home,
                  position: 1,
                },
                {
                  "@type": "ListItem",
                  item: `${origin}/products`,
                  name: copy.chrome.nav.products,
                  position: 2,
                },
                {
                  "@type": "ListItem",
                  item: `${origin}/products/${product.slug}`,
                  name: product.name,
                  position: 3,
                },
              ],
            },
          ],
        }
      : null;

  return (
    <>
      {jsonLd ? (
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
          type="application/ld+json"
        />
      ) : null}
      <ProductDetailView
        addToCartAction={
          product
            ? addProductVariantToCart.bind(null, product.slug)
            : undefined
        }
        cartMessage={getProductCartMessage(query, copy.product)}
        product={product}
      />
    </>
  );
}
