/**
 * Locale configuration (Phase D).
 *
 * Four locales are supported because the settlement areas this prototype is
 * intended for use Urdu, Pashto and Balochi alongside English.
 *
 * PROVISIONAL STATUS: only English strings are complete. The Urdu, Pashto and
 * Balochi catalogues are DRAFTS that require review by a native-speaking
 * department officer before they are shown to the public or relied upon. Any
 * key missing from a catalogue falls back to English, so the interface is never
 * blank or broken.
 */

export const LOCALES = ["en", "ur", "ps", "bal"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that stores the visitor's language choice. */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type Direction = "ltr" | "rtl";

export interface LocaleMeta {
  code: Locale;
  /** Name in English, for administrators. */
  englishName: string;
  /** Name in the language itself, for the language selector. */
  nativeName: string;
  direction: Direction;
  /**
   * True when the catalogue is an unreviewed draft. The UI must not present a
   * provisional locale as approved departmental wording.
   */
  provisional: boolean;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    code: "en",
    englishName: "English",
    nativeName: "English",
    direction: "ltr",
    provisional: false,
  },
  ur: {
    code: "ur",
    englishName: "Urdu",
    nativeName: "اردو",
    direction: "rtl",
    provisional: true,
  },
  ps: {
    code: "ps",
    englishName: "Pashto",
    nativeName: "پښتو",
    direction: "rtl",
    provisional: true,
  },
  bal: {
    code: "bal",
    englishName: "Balochi",
    nativeName: "بلوچی",
    direction: "rtl",
    provisional: true,
  },
};

/** Every locale, in display order. */
export const LOCALE_LIST: readonly LocaleMeta[] = LOCALES.map(
  (code) => LOCALE_META[code],
);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve an arbitrary locale tag (e.g. from `Accept-Language` or a cookie) to
 * a supported locale. Handles region subtags ("ur-PK" -> "ur"), case, and
 * anything unknown -> the default.
 */
export function resolveLocale(candidate: string | null | undefined): Locale {
  if (typeof candidate !== "string") return DEFAULT_LOCALE;
  const primary = candidate.trim().toLowerCase().split(/[-_;,]/)[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

/** Text direction for a locale. */
export function directionFor(locale: Locale): Direction {
  return LOCALE_META[locale].direction;
}

/** True when the locale is right-to-left. */
export function isRtl(locale: Locale): boolean {
  return directionFor(locale) === "rtl";
}

/** True when the catalogue still needs native-speaker review. */
export function isProvisionalLocale(locale: Locale): boolean {
  return LOCALE_META[locale].provisional;
}

/**
 * Pick the best supported locale from an `Accept-Language` header value.
 * Used as a fallback when no choice has been stored yet.
 */
export function resolveFromAcceptLanguage(header: string | null | undefined): Locale {
  if (typeof header !== "string" || header.trim() === "") return DEFAULT_LOCALE;
  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    const resolved = resolveLocale(entry.tag);
    if (isLocale(entry.tag.trim().toLowerCase().split("-")[0])) return resolved;
  }
  return DEFAULT_LOCALE;
}
