import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { BackgroundManager } from "@/components/shell/BackgroundManager";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n/config";
import { readLocaleCookie, writeLocaleCookie, applyDocumentLocale } from "@/lib/i18n/client";

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
 *
 * The inline script below runs BEFORE hydration to apply the locale
 * cookie's language/direction to the <html> element immediately, preventing
 * a flash of wrong direction/language on first paint. It is deliberately
 * inline and synchronous to avoid any flash of wrong direction/language.
 * 
 * suppressHydrationWarning on <html> tells React not to warn about the
 * attributes we set imperatively via the inline script (since they differ
 * from the SSR output).
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read the locale cookie server-side to set initial html attributes.
  // The cookie is already sent by the browser, so we can read it synchronously.
  let initialLocale: string = "en";
  try {
    const cookieStore = await import("next/headers").then((m) => m.cookies());
    const localeCookie = cookieStore.get("locale");
    if (localeCookie?.value) {
      const resolved = resolveLocale(localeCookie.value);
      if (resolved) initialLocale = resolved;
    }
  } catch {
    // Fallback to default if cookie parsing fails
  }

  return (
    <html
      lang={initialLocale}
      dir={initialLocale === "ur" || initialLocale === "ps" || initialLocale === "bal" ? "rtl" : "ltr"}
      className={geistSans.variable + " " + geistMono.variable}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash locale/direction script: runs BEFORE hydration, sets dir/lang on <html> */}
        <Script
          id="locale-direction"
          strategy="beforeInteractive"
        >
          {`
            (function() {
              try {
                var match = document.cookie.match(/(^|;\\s*)locale=([^;]+)/);
                var locale = match ? decodeURIComponent(match[2]) : "en";
                var rtl = locale === "ur" || locale === "ps" || locale === "bal";
                document.documentElement.lang = locale;
                document.documentElement.dir = rtl ? "rtl" : "ltr";
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body>
        {/* Dynamic Multi-Pattern Background Manager with live switcher */}
        <BackgroundManager />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
