import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ZoomPreventer from "@/components/ZoomPreventer";
import CookieConsent from "@/components/CookieConsent";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import AdBlockGuard from "@/components/AdBlockGuard";
import { serverApiUrl } from "@/lib/api";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tagamina.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Minero — Earn Rewards Daily",
  description:
    "Claim micro-rewards every 10 minutes, watch ads, and invite friends to earn more. Cash out to GCash or Maya once you hit ₱300. Sustainable ad-funded platform by Strong Fund Inc.",
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "Minero",
    title: "Minero — Earn real pesos every 10 minutes",
    description:
      "Watch short ads, claim micro-rewards, and earn 10% on every friend you invite — forever. Cash out to GCash or Maya.",
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "Minero — Earn real pesos every 10 minutes",
    description:
      "Watch short ads, claim micro-rewards, and earn 10% on every friend you invite — forever. Cash out to GCash or Maya.",
  },
  keywords: ["earn money online philippines", "gcash rewards", "paid to watch ads", "minero", "tagamina"],
  authors: [{ name: "Strong Fund Inc." }],
  robots: { index: true, follow: true },
  other: {
    monetag: "4c06290e7ec89777783b0ba42e7bd6cc",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#111114",
  colorScheme: "dark",
};

async function getAnnouncementBanner(): Promise<string> {
  try {
    const res = await fetch(`${serverApiUrl()}/config/public`, { next: { revalidate: 60 } });
    if (!res.ok) return "";
    const data = await res.json() as { announcementBanner?: string };
    return data.announcementBanner ?? "";
  } catch {
    return "";
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const banner = await getAnnouncementBanner();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 btn btn-primary btn-sm"
          style={{ zIndex: 100 }}
        >
          Skip to content
        </a>
        <ZoomPreventer />
        {banner && <AnnouncementBanner message={banner} />}
        {children}
        <CookieConsent />
        <AdBlockGuard />
        <Script
          id="block-quge5"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var o=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.tagName==='SCRIPT'&&n.src&&n.src.includes('quge5.com')){n.remove();}});});});o.observe(document.documentElement,{childList:true,subtree:true});})();`,
          }}
        />
        <Script
          id="monetag-ad"
          src="https://ueuee.com/tag.min.js"
          data-zone="10936404"
          strategy="afterInteractive"
        />
        <Script
          id="monetag-ad-2"
          src="https://5gvci.com/act/files/tag.min.js?z=10936442"
          data-cfasync="false"
          strategy="afterInteractive"
        />
        <Script
          id="monetag-ad-3"
          src="https://quge5.com/88/tag.min.js"
          data-zone="236058"
          data-cfasync="false"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
