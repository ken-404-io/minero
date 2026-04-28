import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ZoomPreventer from "@/components/ZoomPreventer";
import CookieConsent from "@/components/CookieConsent";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tagamina.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Minero — Earn Rewards Daily",
  description:
    "Claim micro-rewards every 10 minutes, watch ads, and invite friends to earn more. Cash out to GCash or Maya once you hit ₱300. Sustainable ad-funded platform by Halvex Inc.",
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
  authors: [{ name: "Halvex Inc." }],
  robots: { index: true, follow: true },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
