import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/storefront/empty-state";
import { OrderStatusView } from "@/components/storefront/order-status-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { buildOrderStatusExtras, mapOrderForStorefront } from "@/app/(store)/orders/order-commerce";
import { readCustomerSession } from "@/modules/auth/customer-session";
import { readPickupLocation } from "@/modules/checkout/pickup-location";
import { listCustomerOrders } from "@/modules/orders";
import { readBankTransferConfig } from "@/modules/payments/bank-transfer";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).account.orders;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: { follow: false, index: false },
  };
}

export default async function AccountOrdersPage() {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);
  const accountOrders = copy.account.orders;
  const configured = Boolean(process.env.DATABASE_URL?.trim());

  if (!configured) {
    return (
      <>
        <PageIntro
          breadcrumbLabel={accountOrders.breadcrumb}
          description={accountOrders.description}
          title={accountOrders.title}
        />
        <div className="section-inner">
          <EmptyState
            description={accountOrders.unavailableDescription}
            icon={PackageSearch}
            title={accountOrders.unavailableTitle}
          />
        </div>
      </>
    );
  }

  const session = await readCustomerSession();
  if (!session) redirect("/account");

  // Ownership is the query filter (`orders.user_id = session.id`), so this page
  // never renders another shopper's order and never needs the guest lookup token.
  const { items } = await listCustomerOrders(session.id);
  const bankTransferConfig = readBankTransferConfig();
  const pickupLocation = readPickupLocation();

  return (
    <>
      <PageIntro
        breadcrumbLabel={accountOrders.breadcrumb}
        description={accountOrders.description}
        title={accountOrders.title}
      />
      <div className="section-inner">
        {items.length === 0 ? (
          <EmptyState
            actionHref="/products"
            actionLabel={accountOrders.emptyAction}
            description={accountOrders.emptyDescription}
            icon={PackageSearch}
            title={accountOrders.emptyTitle}
          />
        ) : (
          items.map((order) => (
            <OrderStatusView
              key={order.id}
              copy={copy}
              locale={locale}
              order={mapOrderForStorefront(order, copy.orders, order.history)}
              {...buildOrderStatusExtras({ bankTransferConfig, order, pickupLocation })}
            />
          ))
        )}
        <p className="field-help">
          <Link href="/account">{accountOrders.backToAccount}</Link>
        </p>
      </div>
    </>
  );
}
