import { CalendarX } from "lucide-react";

import { EmptyState } from "@/components/storefront/empty-state";
import { TournamentCard } from "@/components/storefront/tournament-card";
import type { TournamentViewModel } from "@/components/storefront/storefront-types";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

type TournamentListProps = {
  emptyDescription?: string;
  tournaments: TournamentViewModel[];
};

export async function TournamentList({
  emptyDescription,
  tournaments,
}: TournamentListProps) {
  const copy = getStorefrontCopy(await readStorefrontLocale()).tournaments;

  if (tournaments.length === 0) {
    return (
      <EmptyState
        description={emptyDescription ?? copy.empty.description}
        icon={CalendarX}
        title={copy.empty.title}
      />
    );
  }

  return (
    <ul className="tournament-list">
      {tournaments.map((tournament) => (
        <li key={tournament.slug}>
          <TournamentCard tournament={tournament} />
        </li>
      ))}
    </ul>
  );
}
