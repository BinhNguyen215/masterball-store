import { CalendarX } from "lucide-react";

import { EmptyState } from "@/components/storefront/empty-state";
import { TournamentCard } from "@/components/storefront/tournament-card";
import type { TournamentViewModel } from "@/components/storefront/storefront-types";

export function TournamentList({
  emptyDescription = "Chưa có thông báo giải đấu đã xuất bản phù hợp. Cửa hàng sẽ chỉ hiển thị lịch đã xác nhận.",
  tournaments,
}: {
  emptyDescription?: string;
  tournaments: TournamentViewModel[];
}) {
  if (tournaments.length === 0) {
    return (
      <EmptyState
        description={emptyDescription}
        icon={CalendarX}
        title="Chưa có lịch thi đấu"
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
