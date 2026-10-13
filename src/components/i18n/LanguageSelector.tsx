"use client";

/**
 * Language selector for the top bar (Phase D).
 *
 * Changes the locale cookie, updates the document language/direction instantly,
 * and refreshes the page so server-rendered content re-renders in the new locale.
 */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { readLocaleCookie, writeLocaleCookie, applyDocumentLocale } from "@/lib/i18n/client";
import { LOCALE_LIST, resolveLocale, type Locale } from "@/lib/i18n/config";

export function LanguageSelector() {
  const router = useRouter();
  const locale = readLocaleCookie();

  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = resolveLocale(event.target.value);
    writeLocaleCookie(next);
    // Immediately update the document so direction/language are correct
    // before the navigation fires (prevents a flash of wrong direction).
    applyDocumentLocale(next);
    router.refresh();
  }, []);

  return (
    <div className="locale-selector">
      <label htmlFor="locale" className="sr-only">
        Language
      </label>
      <select
        id="locale"
        className="input"
        value={locale}
        onChange={handleChange}
        aria-label="Language"
      >
        {LOCALE_LIST.map((meta) => (
          <option key={meta.code} value={meta.code}>
            {meta.nativeName}
            {meta.provisional ? " (draft)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}