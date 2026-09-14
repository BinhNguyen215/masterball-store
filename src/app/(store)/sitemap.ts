import type { MetadataRoute } from "next";

import { listPublishedProductSitemapEntries } from "@/modules/catalog";
import { listPublishedTournamentSitemapEntries } from "@/modules/tournaments";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!origin) {
    return [];
  }

  const baseEntries: MetadataRoute.Sitemap = [
    { changeFrequency: "weekly", priority: 1, url: origin },
    { changeFrequency: "daily", priority: 0.9, url: `${origin}/products` },
    { changeFrequency: "daily", priority: 0.8, url: `${origin}/tournaments` },
  ];
  if (!process.env.DATABASE_URL?.trim()) return baseEntries;

  const [products, tournaments] = await Promise.all([
    listPublishedProductSitemapEntries(),
    listPublishedTournamentSitemapEntries(),
  ]);
  return [
    ...baseEntries,
    ...products.map((product) => ({
      changeFrequency: "weekly" as const,
      lastModified: product.updatedAt,
      priority: 0.7,
      url: `${origin}/products/${encodeURIComponent(product.slug)}`,
    })),
    ...tournaments.map((tournament) => ({
      changeFrequency: "weekly" as const,
      lastModified: tournament.updatedAt,
      priority: 0.6,
      url: `${origin}/tournaments/${encodeURIComponent(tournament.slug)}`,
    })),
  ];
}
