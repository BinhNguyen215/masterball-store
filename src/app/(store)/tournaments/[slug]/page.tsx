import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadStorefrontTournament } from "@/components/storefront/storefront-data";
import { TournamentDetailView } from "@/components/storefront/tournament-detail-view";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).tournaments;
  const { tournament } = await loadStorefrontTournament(slug, locale);

  if (!tournament) {
    return {
      title: copy.detail.metaTitle,
      description: copy.detail.metaDescription,
      robots: { follow: false, index: false },
    };
  }

  return {
    alternates: { canonical: `/tournaments/${tournament.slug}` },
    description: tournament.summary,
    title: tournament.title,
  };
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await readStorefrontLocale();
  const { configured, tournament } = await loadStorefrontTournament(slug, locale);

  if (configured && !tournament) {
    notFound();
  }

  return <TournamentDetailView tournament={tournament} />;
}
