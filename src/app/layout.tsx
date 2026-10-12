import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import type { ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Transport Security & Compliance - Development Preview",
    template: "%s - Transport Security & Compliance",
  },
  description:
    "Internal development preview of a passenger transport security and compliance management system for Balochistan. Unapproved development project using synthetic data - not an official government service.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#141414",
};

/**
 * Root layout renders the application shell around every route.
 *
 * Identity is resolved server-side inside the shell's UserTopBar (fetched
 * once from /api/me) and inside each protected page's server guard, so no
 * identity resolution happens here. This keeps the root layout free of
 * blocking build-time calls (like headers()) that would prevent route
 * prerendering of the not-found page.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable + " " + geistMono.variable}>
      <body>
        {/* Exact supplied geometric pattern, fixed behind everything */}
        <div className="app-background" aria-hidden="true" />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
