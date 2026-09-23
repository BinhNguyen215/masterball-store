import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type PageIntroProps = {
  title: string;
  description: string;
  breadcrumbLabel: string;
};

export async function PageIntro({
  title,
  description,
  breadcrumbLabel,
}: PageIntroProps) {
  const copy = getStorefrontCopy(await readStorefrontLocale()).chrome;

  return (
    <header className="page-hero">
      <div className="section-inner">
        <Breadcrumb
          items={[
            { href: "/", label: copy.breadcrumb.home },
            { label: breadcrumbLabel },
          ]}
        />
        <div className="section-heading">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
    </header>
  );
}
