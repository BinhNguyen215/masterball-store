import { CalendarX, Clock3, MapPin, UsersRound } from "lucide-react";

import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { ButtonLink } from "@/components/storefront/button-link";
import { EmptyState } from "@/components/storefront/empty-state";
import { formatVietnamDateTime } from "@/components/storefront/storefront-formatters";
import type { TournamentDetailViewModel } from "@/components/storefront/storefront-types";
import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";

export async function TournamentDetailView({
  tournament,
}: {
  tournament: TournamentDetailViewModel | null;
}) {
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);

  if (!tournament) {
    return (
      <div className="section-inner">
        <EmptyState
          actionHref="/tournaments"
          actionLabel={copy.tournaments.detail.unavailableAction}
          description={copy.tournaments.detail.unavailableDescription}
          icon={CalendarX}
          title={copy.tournaments.detail.unavailableTitle}
        />
      </div>
    );
  }

  return (
    <div className="detail-page section-inner">
      <Breadcrumb
        items={[
          { href: "/", label: copy.chrome.breadcrumb.home },
          { href: "/tournaments", label: copy.tournaments.breadcrumb },
          { label: tournament.title },
        ]}
      />
      <article className="tournament-detail">
        <header>
          <p className="meta-label">{tournament.game}</p>
          <h1>{tournament.title}</h1>
          <p className="tournament-summary">{tournament.summary}</p>
        </header>
        <dl className="tournament-detail-meta">
          <div>
            <Clock3 aria-hidden="true" size={20} strokeWidth={1.8} />
            <dt>{copy.tournaments.fields.time}</dt>
            <dd>{formatVietnamDateTime(tournament.startsAt, locale)}</dd>
          </div>
          <div>
            <MapPin aria-hidden="true" size={20} strokeWidth={1.8} />
            <dt>{copy.tournaments.fields.venue}</dt>
            <dd>{tournament.location}</dd>
          </div>
          {tournament.capacityLabel ? (
            <div>
              <UsersRound aria-hidden="true" size={20} strokeWidth={1.8} />
              <dt>{copy.tournaments.fields.capacity}</dt>
              <dd>{tournament.capacityLabel}</dd>
            </div>
          ) : null}
        </dl>
        <section aria-labelledby="tournament-rules-title" className="policy-content">
          <h2 id="tournament-rules-title">
            {copy.tournaments.detail.rulesHeading}
          </h2>
          <ul>
            {tournament.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
        {tournament.contactHref && tournament.contactLabel ? (
          <ButtonLink href={tournament.contactHref}>
            {tournament.contactLabel}
          </ButtonLink>
        ) : null}
      </article>
    </div>
  );
}
