import type { Metadata } from "next";

import { CheckoutView } from "@/components/storefront/checkout-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { CartError, getCart } from "@/modules/cart";
import { readPickupLocation } from "@/modules/checkout/pickup-location";
import { listVietnamProvinces } from "@/modules/checkout/vietnam-locations";
import { readBankTransferConfig } from "@/modules/payments/bank-transfer";

import { createCheckoutOrder } from "./actions";
import { readCartToken } from "../cart/cart-cookie";
import {
  isCheckoutReady,
  mapCartItems,
  type CartSnapshot,
} from "../cart/cart-commerce";
import { getCheckoutPageMessage } from "./checkout-commerce";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).checkout.checkout;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: { follow: false, index: false },
  };
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).checkout.checkout;
  const provinces = await listVietnamProvinces();
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  let snapshot: CartSnapshot | null = null;
  let loadMessage: { kind: "error"; text: string } | undefined;

  if (configured) {
    const token = await readCartToken();
    if (token) {
      try {
        snapshot = await getCart(token);
        if (!isCheckoutReady(snapshot)) {
          loadMessage = {
            kind: "error",
            text: copy.messageEmptyCart,
          };
        }
      } catch (error) {
        loadMessage = {
          kind: "error",
          text: error instanceof CartError ? copy.messageExpired : copy.messageLoadFailed,
        };
      }
    } else {
      loadMessage = {
        kind: "error",
        text: copy.messageNoCart,
      };
    }
  } else {
    loadMessage = {
      kind: "error",
      text: copy.messageUnavailable,
    };
  }

  const enabled = snapshot ? isCheckoutReady(snapshot) : false;

  return (
    <>
      <PageIntro
        breadcrumbLabel={copy.breadcrumb}
        description={copy.description}
        title={copy.title}
      />
      <div className="section-inner">
        <CheckoutView
          bankTransferAvailable={readBankTransferConfig() !== null}
          cartVersion={snapshot?.version}
          checkoutAction={enabled ? createCheckoutOrder : undefined}
          copy={copy}
          coupons={getStorefrontCopy(locale).coupons}
          enabled={enabled}
          items={snapshot ? mapCartItems(snapshot, locale) : []}
          locale={locale}
          message={getCheckoutPageMessage(query, locale) ?? loadMessage}
          pickup={readPickupLocation()}
          provinces={provinces}
          subtotalVnd={snapshot?.subtotalVnd ?? 0}
        />
      </div>
    </>
  );
}
