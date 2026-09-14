import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadStorefrontTournament } from "@/components/storefront/storefront-data";
import { TournamentDetailView } from "@/components/storefront/tournament-detail-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { tournament } = await loadStorefrontTournament(slug);

  if (!tournament) {
    return {
      title: "Thông báo giải đấu chưa sẵn sàng",
      description: "Thông tin giải đấu TCG từ MasterBall Store.",
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
  const { configured, tournament } = await loadStorefrontTournament(slug);

  if (configured && !tournament) {
    notFound();
  }

  return <TournamentDetailView tournament={tournament} />;
}
