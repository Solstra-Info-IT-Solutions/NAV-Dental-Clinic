import type { Metadata, Viewport } from "next";
import { Cinzel, Montserrat } from "next/font/google";

import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n";

import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

// Page-specific titles/descriptions are set per route; canonical URLs,
// Open Graph images and JSON-LD are completed in Phase 7.
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "NAV Dental Clinic, Pahasu | Dr. Ratan Raghav",
    template: "%s | NAV Dental Clinic, Pahasu",
  },
  description:
    "NAV Dental Clinic on Somna Road, Pahasu. Request a dental appointment with Dr. Ratan Raghav or call +91 80066 06001.",
  applicationName: "NAV Dental Clinic",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#131313",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const t = getDictionary();
  return (
    <html lang="en-IN" className={`${cinzel.variable} ${montserrat.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-platinum-100 px-4 py-3 font-semibold text-ink-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t.common.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
