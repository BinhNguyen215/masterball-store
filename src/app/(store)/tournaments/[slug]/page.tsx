import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatVnd } from "@/components/storefront/storefront-formatters";
import { loadStorefrontTournament } from "@/components/storefront/storefront-data";
import { TournamentDetailView } from "@/components/storefront/tournament-detail-view";
import { formatCopy, getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
import { getTournamentRegistrationSummary } from "@/modules/tournaments";

import { submitTournamentRegistration } from "./actions";
import { getRegistrationMessage } from "./registration-commerce";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string | string[]; registration?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const locale = await readStorefrontLocale();
  const copy = getStorefrontCopy(locale);
  const { configured, tournament } = await loadStorefrontTournament(slug, locale);

  if (configured && !tournament) {
    notFound();
  }

  const summary = tournament ? await getTournamentRegistrationSummary(slug) : null;
  const message = getRegistrationMessage(query, copy.registrations);
  const isFull =
    summary !== null &&
    summary.capacity !== null &&
    summary.registered >= summary.capacity;

  const capacityText = !summary
    ? ""
    : summary.capacity === null
      ? formatCopy(copy.registrations.unlimitedCapacity, { registered: summary.registered })
      : formatCopy(copy.registrations.capacityLabel, {
          registered: summary.registered,
          capacity: summary.capacity,
        });
  const feeText = !summary
    ? ""
    : summary.feeVnd > 0
      ? formatCopy(copy.registrations.feeLabel, { amount: formatVnd(summary.feeVnd, locale) })
      : copy.registrations.freeLabel;

  return (
    <>
      <TournamentDetailView tournament={tournament} />
      {tournament && summary ? (
        <div className="section-inner">
          <div className="checkout-layout">
            <section aria-labelledby="tournament-registration-title" className="checkout-panel">
              <h2 id="tournament-registration-title">{copy.registrations.heading}</h2>
              <p className="field-help">{copy.registrations.description}</p>
              {message ? (
                <div className="notice" role={message.kind === "error" ? "alert" : "status"}>
                  <p>{message.text}</p>
                </div>
              ) : null}
              {summary.registrationOpen ? (
                <>
                  {isFull ? (
                    <div className="notice" role="status">
                      <p>{copy.registrations.fullNotice}</p>
                    </div>
                  ) : null}
                  <form action={submitTournamentRegistration} className="checkout-form">
                    <input name="slug" type="hidden" value={tournament.slug} />
                    <div className="field">
                      <label className="field-label" htmlFor="registration-name">
                        {copy.registrations.fieldName}
                      </label>
                      <input
                        autoComplete="name"
                        id="registration-name"
                        maxLength={120}
                        minLength={2}
                        name="fullName"
                        required
                        type="text"
                      />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="registration-phone">
                        {copy.registrations.fieldPhone}
                      </label>
                      <input
                        autoComplete="tel"
                        id="registration-phone"
                        inputMode="tel"
                        maxLength={20}
                        name="phone"
                        pattern="[0-9+][0-9 .-]{7,19}"
                        required
                        type="tel"
                      />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="registration-email">
                        {copy.registrations.fieldEmail}
                      </label>
                      <input
                        autoComplete="email"
                        id="registration-email"
                        maxLength={254}
                        name="email"
                        type="email"
                      />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="registration-note">
                        {copy.registrations.fieldNote}
                      </label>
                      <textarea
                        id="registration-note"
                        maxLength={1000}
                        name="note"
                        rows={3}
                      />
                    </div>
                    <button className="button button--primary" type="submit">
                      {copy.registrations.submit}
                    </button>
                  </form>
                </>
              ) : (
                <div className="notice" role="status">
                  <p>{copy.registrations.closedNotice}</p>
                </div>
              )}
            </section>
            <aside className="summary-panel">
              <p>{capacityText}</p>
              {summary.waitlisted > 0 ? (
                <p>
                  {formatCopy(copy.registrations.waitlistLabel, {
                    count: summary.waitlisted,
                  })}
                </p>
              ) : null}
              <p>{feeText}</p>
            </aside>
          </div>
        </div>
      ) : null}
    </>
  );
}
