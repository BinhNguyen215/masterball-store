import type { Metadata } from "next";

import { CartView } from "@/components/storefront/cart-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { CartError, getCart } from "@/modules/cart";

import { removeCartItem, updateCartItem } from "./actions";
import { readCartToken } from "./cart-cookie";
import {
  getCartPageMessage,
  isActiveCart,
  isCheckoutReady,
  mapCartItems,
  type CartSnapshot,
} from "./cart-commerce";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).checkout.cart;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: { follow: false, index: false },
  };
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).checkout.cart;
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  let snapshot: CartSnapshot | null = null;
  let loadMessage: { kind: "error" | "success"; text: string } | undefined;

  if (configured) {
    const token = await readCartToken();
    if (token) {
      try {
        snapshot = await getCart(token);
        if (!isActiveCart(snapshot)) {
          snapshot = null;
          loadMessage = {
            kind: "error",
            text: copy.messageInactive,
          };
        }
      } catch (error) {
        loadMessage = {
          kind: "error",
          text:
            error instanceof CartError
              ? copy.messageUnopenable
              : copy.messageLoadFailed,
        };
      }
    }
  } else {
    loadMessage = {
      kind: "error",
      text: copy.messageUnavailable,
    };
  }

  const ready = snapshot ? isCheckoutReady(snapshot) : false;

  return (
    <>
      <PageIntro
        breadcrumbLabel={copy.breadcrumb}
        description={copy.description}
        title={copy.title}
      />
      <div className="section-inner">
        <CartView
          cartVersion={snapshot?.version}
          checkoutAvailable={ready}
          copy={copy}
          items={snapshot ? mapCartItems(snapshot, locale) : []}
          locale={locale}
          message={getCartPageMessage(query, locale) ?? loadMessage}
          removeItemAction={snapshot ? removeCartItem : undefined}
          updateQuantityAction={snapshot ? updateCartItem : undefined}
        />
      </div>
    </>
  );
}
