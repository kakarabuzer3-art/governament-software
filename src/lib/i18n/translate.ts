/**
 * Translation lookup (Phase D). Pure functions — usable on the server and in
 * the browser, and unit testable without a DOM.
 */
import { DEFAULT_LOCALE, type Locale } from "./config";
import { EN_MESSAGES, MESSAGES } from "./messages";

export type MessageParams = Record<string, string | number>;

/**
 * Replace `{name}` placeholders. A placeholder with no supplied value is left
 * visible on purpose, so a missing parameter is noticed rather than rendering
 * "undefined".
 */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

/**
 * Translate a key for a locale.
 *
 * Fallback order: requested locale -> English -> the key itself. The interface
 * therefore never renders an empty string, even for a partially translated
 * catalogue, and an unknown key is obvious rather than silent.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: MessageParams,
): string {
  const fromLocale = MESSAGES[locale]?.[key];
  const value =
    fromLocale ?? EN_MESSAGES[key] ?? (locale === DEFAULT_LOCALE ? key : key);
  return interpolate(value, params);
}

/** True when the locale has its OWN entry (not an English fallback). */
export function isTranslated(locale: Locale, key: string): boolean {
  if (locale === DEFAULT_LOCALE) return key in EN_MESSAGES;
  return typeof MESSAGES[locale]?.[key] === "string";
}

/** Keys present in English but absent from the given locale. */
export function missingKeys(locale: Locale): string[] {
  if (locale === DEFAULT_LOCALE) return [];
  const catalogue = MESSAGES[locale] ?? {};
  return Object.keys(EN_MESSAGES).filter((key) => !(key in catalogue));
}

/** Fraction (0–1) of the English catalogue translated for this locale. */
export function catalogueCoverage(locale: Locale): number {
  const total = Object.keys(EN_MESSAGES).length;
  if (total === 0) return 1;
  if (locale === DEFAULT_LOCALE) return 1;
  return (total - missingKeys(locale).length) / total;
}

/** Keys in a locale that are empty strings — a rendering bug if any. */
export function emptyKeys(locale: Locale): string[] {
  const catalogue = MESSAGES[locale] ?? {};
  return Object.entries(catalogue)
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([key]) => key);
}
