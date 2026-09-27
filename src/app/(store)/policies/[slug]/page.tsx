import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/storefront/page-intro";
import { getStorefrontCopy } from "@/i18n";
import { isPolicySlug, POLICY_SLUGS } from "@/i18n/copy/policies";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const copy = getStorefrontCopy(await readStorefrontLocale()).policies;

  if (!isPolicySlug(slug)) {
    return { title: copy.notFoundTitle };
  }

  return {
    title: copy.items[slug].title,
    description: copy.items[slug].description,
    alternates: { canonical: `/policies/${slug}` },
    robots: { follow: false, index: false },
  };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isPolicySlug(slug)) {
    notFound();
  }

  const copy = getStorefrontCopy(await readStorefrontLocale()).policies;
  const policy = copy.items[slug];

  return (
    <>
      <PageIntro
        breadcrumbLabel={policy.title}
        description={policy.description}
        title={policy.title}
      />
      <div className="section-inner policy-layout">
        <nav aria-label={copy.navAria} className="policy-nav">
          {POLICY_SLUGS.map((policySlug) => (
            <Link
              aria-current={policySlug === slug ? "page" : undefined}
              href={`/policies/${policySlug}`}
              key={policySlug}
            >
              {copy.items[policySlug].title}
            </Link>
          ))}
        </nav>
        <div className="notice" role="status">
          <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
          <p>{copy.notice}</p>
        </div>
        <article className="policy-content">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
