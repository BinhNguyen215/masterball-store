import { UserRound } from "lucide-react";
import type { Metadata } from "next";

import { AccountAuthForms, AccountSignOutButton } from "@/components/storefront/account-forms";
import { ButtonLink } from "@/components/storefront/button-link";
import { EmptyState } from "@/components/storefront/empty-state";
import { PageIntro } from "@/components/storefront/page-intro";
import { formatCopy, getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { readCustomerSession } from "@/modules/auth/customer-session";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).account;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: { follow: false, index: false },
  };
}

export default async function AccountPage() {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);
  const account = copy.account;
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  const session = configured ? await readCustomerSession() : null;

  return (
    <>
      <PageIntro
        breadcrumbLabel={account.breadcrumb}
        description={account.description}
        title={account.title}
      />
      <div className="section-inner">
        {!configured ? (
          <EmptyState
            description={account.unavailableDescription}
            icon={UserRound}
            title={account.unavailableTitle}
          />
        ) : session ? (
          <section aria-labelledby="account-profile-title" className="summary-panel">
            <h2 id="account-profile-title">{account.profileTitle}</h2>
            <p>{formatCopy(account.greeting, { name: session.name })}</p>
            <dl>
              <dt className="meta-label">{account.profileNameLabel}</dt>
              <dd>{session.name}</dd>
              <dt className="meta-label">{account.profileEmailLabel}</dt>
              <dd>{session.email}</dd>
            </dl>
            <div className="button-row">
              <ButtonLink href="/account/orders" variant="primary">
                {account.ordersLink}
              </ButtonLink>
              <AccountSignOutButton copy={account} />
            </div>
            <p className="field-help">{account.ordersDescription}</p>
          </section>
        ) : (
          <AccountAuthForms copy={account} />
        )}
      </div>
    </>
  );
}
