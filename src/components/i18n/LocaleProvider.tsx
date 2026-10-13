"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { translate, type MessageParams } from "@/lib/i18n/translate";
import { readLocaleCookie, writeLocaleCookie, applyDocumentLocale, type Locale } from "@/lib/i18n/client";
import { resolveLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: MessageParams) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") return readLocaleCookie();
    return DEFAULT_LOCALE;
  });

  // On mount: read cookie and apply to document
  useEffect(() => {
    const initial = readLocaleCookie();
    applyDocumentLocale(initial);
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    const resolved = resolveLocale(next);
    setLocaleState(resolved);
    applyDocumentLocale(resolved);
    writeLocaleCookie(resolved);
    router.refresh(); // re-render server content in new locale
  }, [router]);

  const t = useCallback(
    (key: string, params?: MessageParams) => {
      return translate(locale, key, params);
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within a LocaleProvider");
  return ctx.t;
}