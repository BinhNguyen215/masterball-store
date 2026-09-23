import { ArrowRight, CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/storefront/button-link";
import { ProductGrid } from "@/components/storefront/product-grid";
import { loadStorefrontHome } from "@/components/storefront/storefront-data";
import { TournamentCard } from "@/components/storefront/tournament-card";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).home;
  return {
    title: { absolute: copy.metaTitle },
    description: copy.metaDescription,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).home;
  const { configured, products, tournaments } = await loadStorefrontHome(locale);

  const categories = [
    {
      href: "/products?game=pokemon",
      name: copy.categoryPokemonName,
      note: copy.categoryPokemonNote,
    },
    {
      href: "/products?game=riftbound",
      name: copy.categoryRiftboundName,
      note: copy.categoryRiftboundNote,
    },
    {
      href: "/products?type=accessory",
      name: copy.categoryAccessoryName,
      note: copy.categoryAccessoryNote,
    },
  ] as const;

  return (
    <>
      <section className="hero">
        <div className="hero-media">
          <Image
            alt={copy.heroImageAlt}
            fill
            priority
            sizes="100vw"
            src="/images/tcg-hero.webp"
          />
        </div>
        <div className="hero-content">
          <div className="hero-copy">
            <p className="hero-eyebrow" translate="no">
              {copy.heroEyebrow}
            </p>
            <h1 className="hero-title">
              {copy.heroTitleLead} <span>{copy.heroTitleAccent}</span>
              <small>{copy.heroTitleSub}</small>
            </h1>
            <p className="hero-description">
              {copy.heroDescription}
              <br />
              {copy.heroDescriptionEnglish}
            </p>
            <div className="hero-actions">
              <ButtonLink href="/products" icon={ArrowRight}>
                {copy.heroShop}
              </ButtonLink>
              <ButtonLink href="/tournaments" variant="secondary">
                {copy.heroEvents}
              </ButtonLink>
            </div>
            <span aria-hidden="true" className="capture-mark hero-capture" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-heading">
            <h2>{copy.categoriesTitle}</h2>
            <p>{copy.categoriesDescription}</p>
          </div>
          <ul className="category-index">
            {categories.map((category) => (
              <li key={category.href}>
                <Link className="category-link" href={category.href}>
                  <strong>{category.name}</strong>
                  <span>{category.note}</span>
                  <ArrowRight aria-hidden="true" size={28} strokeWidth={1.8} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--raised">
        <div className="section-inner">
          <div className="section-heading">
            <h2>
              {products.length > 0 ? copy.featuredTitle : copy.featuredPreparingTitle}
            </h2>
            <p>{copy.featuredDescription}</p>
          </div>
          <ProductGrid
            emptyDescription={configured ? copy.featuredEmpty : copy.featuredUnconfigured}
            products={products}
          />
        </div>
      </section>

      <section className="section">
        <div className="section-inner tournament-empty-band">
          <div>
            <CalendarClock aria-hidden="true" size={32} strokeWidth={1.6} />
            <h2>{copy.eventsTitle}</h2>
          </div>
          {tournaments[0] ? (
            <TournamentCard tournament={tournaments[0]} />
          ) : (
            <div>
              <p>{copy.eventsEmpty}</p>
              <ButtonLink href="/tournaments" variant="secondary">
                {copy.eventsLink}
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
