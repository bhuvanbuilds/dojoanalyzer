import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme";
import { ThemeHotkey } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Mono is only used for small labels; don't let it compete with first paint.
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dojo Belt Analyzer",
    template: "%s · Dojo Belt Analyzer",
  },
  description: "Track Kalvium Dojo belt progress across squads and language tracks.",
  applicationName: "Dojo Belt Analyzer",
  openGraph: {
    type: "website",
    siteName: "Dojo Belt Analyzer",
    title: "Dojo Belt Analyzer",
    description: "Track Kalvium Dojo belt progress across squads and language tracks.",
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {SUPABASE_URL ? <link rel="preconnect" href={SUPABASE_URL} crossOrigin="" /> : null}
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeHotkey />
        {children}
      </body>
    </html>
  );
}
