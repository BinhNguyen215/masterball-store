import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusView } from "@/components/storefront/order-status-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { getOrderByLookupToken } from "@/modules/orders";

import {
  isValidOrderLookupToken,
  mapOrderForStorefront,
} from "../order-commerce";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).orders;
  return {
    title: copy.metaTitle,
    description: copy.tokenMetaDescription,
    referrer: "no-referrer",
    robots: { follow: false, index: false, nocache: true },
  };
}

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidOrderLookupToken(token)) notFound();

  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);

  let order = null;
  if (process.env.DATABASE_URL?.trim()) {
    const result = await getOrderByLookupToken(token);
    if (!result) notFound();
    order = mapOrderForStorefront(result, copy.orders);
  }

  return (
    <>
      <PageIntro
        breadcrumbLabel={copy.orders.breadcrumb}
        description={copy.orders.tokenDescription}
        title={copy.orders.lookupTitle}
      />
      <div className="section-inner">
        <OrderStatusView copy={copy} locale={locale} order={order} />
        <p className="field-help">
          {copy.orders.tokenLookupPrompt}{" "}
          <Link href="/orders">{copy.orders.tokenLookupLink}</Link>.
        </p>
      </div>
    </>
  );
}
