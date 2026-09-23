import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";

import { formatVietnamDateTime } from "@/components/storefront/storefront-formatters";
import type { TournamentViewModel } from "@/components/storefront/storefront-types";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export async function TournamentCard({
  tournament,
}: {
  tournament: TournamentViewModel;
}) {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale).tournaments;

  return (
    <article className="tournament-card">
      <div>
        <p className="meta-label">{tournament.game}</p>
        <h2>
          <Link href={`/tournaments/${tournament.slug}`}>{tournament.title}</Link>
        </h2>
      </div>
      <dl className="tournament-meta">
        <div>
          <CalendarDays aria-hidden="true" size={18} strokeWidth={1.8} />
          <dt className="sr-only">{copy.fields.time}</dt>
          <dd>{formatVietnamDateTime(tournament.startsAt, locale)}</dd>
        </div>
        <div>
          <MapPin aria-hidden="true" size={18} strokeWidth={1.8} />
          <dt className="sr-only">{copy.fields.venue}</dt>
          <dd>{tournament.location}</dd>
        </div>
        <div>
          <dt>{copy.fields.status}</dt>
          <dd>{copy.status[tournament.status]}</dd>
        </div>
      </dl>
    </article>
  );
}
