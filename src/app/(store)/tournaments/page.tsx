import type { Metadata } from "next";

import { PageIntro } from "@/components/storefront/page-intro";
import { TournamentFilterForm } from "@/components/storefront/tournament-filter-form";
import { TournamentList } from "@/components/storefront/tournament-list";
import { loadStorefrontTournaments } from "@/components/storefront/storefront-data";

export const metadata: Metadata = {
  title: "Giải đấu TCG",
  description:
    "Theo dõi lịch, địa điểm và thông báo giải đấu TCG đã được MasterBall Store xác nhận.",
  alternates: { canonical: "/tournaments" },
};

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
  const { configured, tournaments } = await loadStorefrontTournaments({
    game,
    status,
  });

  return (
    <>
      <PageIntro
        breadcrumbLabel="Giải đấu"
        description="Chỉ những thông báo đã xác nhận mới xuất hiện, với thời gian hiển thị theo múi giờ Việt Nam."
        title="Gặp nhau quanh bàn đấu"
      />
      <div className="section-inner tournament-page">
        <TournamentFilterForm
          values={{
            game,
            status,
          }}
        />
        <TournamentList
          emptyDescription={
            configured
              ? undefined
              : "Lịch giải đấu chưa được kết nối với cơ sở dữ liệu. Không có thời gian hay địa điểm mẫu được hiển thị."
          }
          tournaments={tournaments}
        />
      </div>
    </>
  );
}
