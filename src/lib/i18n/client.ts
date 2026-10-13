/**
 * Client-side locale utilities for reading/writing cookies and manipulating the document.
 */
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  resolveLocale,
  directionFor,
  type Locale,
} from "./config";

/**
 * Read the current locale from document.cookie in the browser.
 */
export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  return resolveLocale(match ? decodeURIComponent(match[1]) : null);
}

/**
 * Set the locale cookie in the browser.
 */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(
    locale,
  )}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * Immediately apply the lang and dir attributes to the document root element.
 */
export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = directionFor(locale);
}

export type { Locale };
