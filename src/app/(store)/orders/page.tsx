import type { Metadata } from "next";

import { OrderLookupForm } from "@/components/storefront/order-lookup-form";
import { OrderStatusView } from "@/components/storefront/order-status-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { getOrderById } from "@/modules/orders";

import { forgetOrder, lookupOrder } from "./actions";
import {
  firstSearchParam,
  getOrderLookupMessage,
  mapOrderForStorefront,
} from "./order-commerce";
import { readOrderAccessOrderId } from "./order-cookie";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).orders;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    referrer: "no-referrer",
    robots: { follow: false, index: false, nocache: true },
  };
}

export default async function OrderLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; number?: string | string[] }>;
}) {
  const query = await searchParams;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  const orderId = configured ? await readOrderAccessOrderId() : null;
  const order = orderId ? await getOrderById(orderId) : null;
  const message =
    getOrderLookupMessage(query, copy.orders) ??
    (configured
      ? undefined
      : getOrderLookupMessage({ error: "unavailable" }, copy.orders));

  return (
    <>
      <PageIntro
        breadcrumbLabel={copy.orders.breadcrumb}
        description={copy.orders.lookupDescription}
        title={copy.orders.lookupTitle}
      />
      <div className="section-inner">
        {order ? (
          <>
            <OrderStatusView
              copy={copy}
              locale={locale}
              order={mapOrderForStorefront(order, copy.orders)}
            />
            <form action={forgetOrder} className="button-row">
              <button className="button button--secondary" type="submit">
                {copy.orders.lookupAnother}
              </button>
            </form>
          </>
        ) : (
          <OrderLookupForm
            copy={copy}
            enabled={configured}
            lookupAction={configured ? lookupOrder : undefined}
            message={message}
            orderNumber={firstSearchParam(query.number)}
          />
        )}
      </div>
    </>
  );
}
