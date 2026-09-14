import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";

import { formatVietnamDateTime } from "@/components/storefront/storefront-formatters";
import type { TournamentViewModel } from "@/components/storefront/storefront-types";

const statusLabel = {
  cancelled: "Đã hủy",
  ended: "Đã kết thúc",
  open: "Đang nhận thông tin quan tâm",
  upcoming: "Sắp diễn ra",
} as const;

export function TournamentCard({ tournament }: { tournament: TournamentViewModel }) {
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
          <dt className="sr-only">Thời gian</dt>
          <dd>{formatVietnamDateTime(tournament.startsAt)}</dd>
        </div>
        <div>
          <MapPin aria-hidden="true" size={18} strokeWidth={1.8} />
          <dt className="sr-only">Địa điểm</dt>
          <dd>{tournament.location}</dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>{statusLabel[tournament.status]}</dd>
        </div>
      </dl>
    </article>
  );
}
