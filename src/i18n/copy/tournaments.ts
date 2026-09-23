import { defineCopy } from "@/i18n/storefront";

export const tournamentsCopy = defineCopy({
  vi: {
    title: "Giải đấu",
    description:
      "Lịch thi đấu, thể lệ và thông tin đăng ký do cửa hàng công bố theo giờ Việt Nam.",
    breadcrumb: "Giải đấu",
    metaTitle: "Giải đấu TCG",
    metaDescription:
      "Theo dõi lịch, địa điểm và thông báo giải đấu TCG đã được MasterBall Store xác nhận.",
    introTitle: "Gặp nhau quanh bàn đấu",
    introDescription:
      "Chỉ những thông báo đã xác nhận mới xuất hiện, với thời gian hiển thị theo múi giờ Việt Nam.",
    freeEntry: "Miễn phí",
    onlineVenue: "Thi đấu trực tuyến",
    registerCta: "Xem hướng dẫn tham gia",
    capacityLabel: "{count} người chơi",
    status: {
      upcoming: "Sắp diễn ra",
      open: "Đang diễn ra",
      ended: "Đã kết thúc",
      cancelled: "Đã hủy",
    },
    fields: {
      time: "Thời gian",
      venue: "Địa điểm",
      capacity: "Sức chứa",
      status: "Trạng thái",
    },
    empty: {
      title: "Chưa có lịch thi đấu",
      description:
        "Chưa có thông báo giải đấu đã xuất bản phù hợp. Cửa hàng sẽ chỉ hiển thị lịch đã xác nhận.",
      unconfigured:
        "Lịch giải đấu chưa được kết nối với cơ sở dữ liệu. Không có thời gian hay địa điểm mẫu được hiển thị.",
    },
    detail: {
      rulesHeading: "Thể lệ",
      unavailableTitle: "Thông báo chưa sẵn sàng",
      unavailableDescription:
        "Thông báo này chưa được xuất bản hoặc dữ liệu giải đấu chưa được kết nối. Không có thời gian hay địa điểm tạm được hiển thị.",
      unavailableAction: "Xem lịch giải đấu",
      metaTitle: "Thông báo giải đấu chưa sẵn sàng",
      metaDescription: "Thông tin giải đấu TCG từ MasterBall Store.",
    },
    filter: {
      game: "Trò chơi",
      status: "Trạng thái",
      all: "Tất cả",
      gamePokemon: "Pokémon TCG",
      gameRiftbound: "Riftbound TCG",
      gameOther: "TCG khác",
      submit: "Xem lịch phù hợp",
    },
  },
  en: {
    title: "Events",
    description:
      "Schedule, rules and registration details published by the shop in Vietnam time.",
    breadcrumb: "Events",
    metaTitle: "TCG events",
    metaDescription:
      "Follow confirmed TCG event schedules, venues and announcements from MasterBall Store.",
    introTitle: "Meet around the table",
    introDescription:
      "Only confirmed announcements appear, with times shown in Vietnam time.",
    freeEntry: "Free entry",
    onlineVenue: "Online event",
    registerCta: "See how to join",
    capacityLabel: "{count} players",
    status: {
      upcoming: "Upcoming",
      open: "In progress",
      ended: "Ended",
      cancelled: "Cancelled",
    },
    fields: {
      time: "Time",
      venue: "Venue",
      capacity: "Capacity",
      status: "Status",
    },
    empty: {
      title: "No events scheduled yet",
      description:
        "No published event matches this view yet. The shop only shows confirmed schedules.",
      unconfigured:
        "The event schedule is not connected to the database. No sample times or venues are shown.",
    },
    detail: {
      rulesHeading: "Rules",
      unavailableTitle: "Announcement not ready",
      unavailableDescription:
        "This announcement is not published yet, or event data is not connected. No placeholder times or venues are shown.",
      unavailableAction: "See event schedule",
      metaTitle: "Event announcement not ready",
      metaDescription: "TCG event information from MasterBall Store.",
    },
    filter: {
      game: "Game",
      status: "Status",
      all: "All",
      gamePokemon: "Pokémon TCG",
      gameRiftbound: "Riftbound TCG",
      gameOther: "Other TCG",
      submit: "See matching schedule",
    },
  },
});
