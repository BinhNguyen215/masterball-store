import type { Metadata } from "next";

import { PageIntro } from "@/components/storefront/page-intro";
import { TournamentFilterForm } from "@/components/storefront/tournament-filter-form";
import { TournamentList } from "@/components/storefront/tournament-list";
import { loadStorefrontTournaments } from "@/components/storefront/storefront-data";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStorefrontCopy(await readStorefrontLocale()).tournaments;

  return {
    alternates: { canonical: "/tournaments" },
    description: copy.metaDescription,
    title: copy.metaTitle,
  };
}

type TournamentSearchParams = {
  game?: string | string[];
  status?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<TournamentSearchParams>;
}) {
  const params = await searchParams;
  const game = firstValue(params.game);
  const status = firstValue(params.status);
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).tournaments;
  const { configured, tournaments } = await loadStorefrontTournaments(locale, {
    game,
    status,
  });

  return (
    <>
      <PageIntro
        breadcrumbLabel={copy.breadcrumb}
        description={copy.introDescription}
        title={copy.introTitle}
      />
      <div className="section-inner tournament-page">
        <TournamentFilterForm
          copy={copy.filter}
          statusLabels={copy.status}
          values={{
            game,
            status,
          }}
        />
        <TournamentList
          emptyDescription={configured ? undefined : copy.empty.unconfigured}
          tournaments={tournaments}
        />
      </div>
    </>
  );
}
