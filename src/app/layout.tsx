import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Be_Vietnam_Pro } from "next/font/google";

import "./globals.css";

const displayFont = Barlow_Condensed({
  display: "swap",
  subsets: ["vietnamese"],
  variable: "--font-display-face",
  weight: "700",
});

const bodyFont = Be_Vietnam_Pro({
  display: "swap",
  subsets: ["vietnamese"],
  variable: "--font-body-face",
  weight: ["400", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MasterBall Store | TCG cho bàn đấu của bạn",
    template: "%s | MasterBall Store",
  },
  description:
    "Khám phá sản phẩm TCG, phụ kiện chơi bài và thông báo giải đấu từ MasterBall Store.",
  applicationName: "MasterBall Store",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "MasterBall Store",
    title: "MasterBall Store | TCG cho bàn đấu của bạn",
    description:
      "Sản phẩm TCG, phụ kiện chơi bài và thông báo giải đấu trong một không gian dành cho người sưu tầm.",
    images: [
      {
        url: "/images/tcg-hero.webp",
        width: 1920,
        height: 1080,
        alt: "Bộ sưu tập thẻ và phụ kiện TCG trong không gian ánh sáng xanh tím",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MasterBall Store | TCG cho bàn đấu của bạn",
    description: "Sản phẩm TCG, phụ kiện chơi bài và thông báo giải đấu.",
    images: ["/images/tcg-hero.webp"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090d20",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${displayFont.variable} ${bodyFont.variable}`}
      lang="vi"
    >
      <body>{children}</body>
    </html>
  );
}
