import { CalendarX, Clock3, MapPin, UsersRound } from "lucide-react";

import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { ButtonLink } from "@/components/storefront/button-link";
import { EmptyState } from "@/components/storefront/empty-state";
import { formatVietnamDateTime } from "@/components/storefront/storefront-formatters";
import type { TournamentDetailViewModel } from "@/components/storefront/storefront-types";

export function TournamentDetailView({
  tournament,
}: {
  tournament: TournamentDetailViewModel | null;
}) {
  if (!tournament) {
    return (
      <div className="section-inner">
        <EmptyState
          actionHref="/tournaments"
          actionLabel="Xem lịch giải đấu"
          description="Thông báo này chưa được xuất bản hoặc dữ liệu giải đấu chưa được kết nối. Không có thời gian hay địa điểm tạm được hiển thị."
          icon={CalendarX}
          title="Thông báo chưa sẵn sàng"
        />
      </div>
    );
  }

  return (
    <div className="detail-page section-inner">
      <Breadcrumb
        items={[
          { href: "/", label: "Trang chủ" },
          { href: "/tournaments", label: "Giải đấu" },
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
            <dt>Thời gian</dt>
            <dd>{formatVietnamDateTime(tournament.startsAt)}</dd>
          </div>
          <div>
            <MapPin aria-hidden="true" size={20} strokeWidth={1.8} />
            <dt>Địa điểm</dt>
            <dd>{tournament.location}</dd>
          </div>
          {tournament.capacityLabel ? (
            <div>
              <UsersRound aria-hidden="true" size={20} strokeWidth={1.8} />
              <dt>Sức chứa</dt>
              <dd>{tournament.capacityLabel}</dd>
            </div>
          ) : null}
        </dl>
        <section aria-labelledby="tournament-rules-title" className="policy-content">
          <h2 id="tournament-rules-title">Thể lệ</h2>
          <ul>
            {tournament.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
        {tournament.contactHref && tournament.contactLabel ? (
          <ButtonLink href={tournament.contactHref}>{tournament.contactLabel}</ButtonLink>
        ) : null}
      </article>
    </div>
  );
}
