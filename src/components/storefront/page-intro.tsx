import { Breadcrumb } from "@/components/storefront/breadcrumb";

type PageIntroProps = {
  title: string;
  description: string;
  breadcrumbLabel: string;
};

export function PageIntro({
  title,
  description,
  breadcrumbLabel,
}: PageIntroProps) {
  return (
    <header className="page-hero">
      <div className="section-inner">
        <Breadcrumb
          items={[{ href: "/", label: "Trang chủ" }, { label: breadcrumbLabel }]}
        />
        <div className="section-heading">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
    </header>
  );
}
