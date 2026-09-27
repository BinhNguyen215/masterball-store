import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Be_Vietnam_Pro } from "next/font/google";

import { getStorefrontCopy } from "@/i18n";
import { readStorefrontLocale } from "@/i18n/storefront-locale";
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

/**
 * The root metadata is the fallback for routes that publish none, so it has to
 * follow the selected locale; a static export would ship Vietnamese tags to
 * every English page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await readStorefrontLocale();
  const home = getStorefrontCopy(locale).home;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: home.metaTitle,
      template: "%s | MasterBall Store",
    },
    description: home.metaDescription,
    applicationName: "MasterBall Store",
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "vi_VN",
      siteName: "MasterBall Store",
      title: home.metaTitle,
      description: home.metaDescription,
      images: [
        {
          url: "/images/tcg-hero.webp",
          width: 1920,
          height: 1080,
          alt: home.heroImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: home.metaTitle,
      description: home.metaDescription,
      images: ["/images/tcg-hero.webp"],
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090d20",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await readStorefrontLocale();

  return (
    <html
      className={`${displayFont.variable} ${bodyFont.variable}`}
      lang={locale}
    >
      <body>{children}</body>
    </html>
  );
}
