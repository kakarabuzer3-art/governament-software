import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

/** Sections of the public information site, in navigation order. */
export const PUBLIC_NAV = [
  { href: "/info", label: "Overview" },
  { href: "/info/guidance", label: "Passenger guidance" },
  { href: "/info/permits", label: "Permit procedures" },
  { href: "/info/notices", label: "Security notices" },
  { href: "/info/faqs", label: "FAQs" },
  { href: "/info/contact", label: "Contact" },
] as const;

export interface PublicShellProps {
  title: string;
  intro: string;
  children: ReactNode;
  /** Marks the active navigation entry. */
  activeHref?: string;
}

/**
 * Frame for every public page.
 *
 * This surface is anonymous, indexable and completely separate from the
 * administrative portal: it links to nothing behind authentication and reveals
 * no internal navigation.
 */
export function PublicShell({
  title,
  intro,
  children,
  activeHref,
}: PublicShellProps) {
  return (
    <div className="public-site">
      <p className="public-banner" role="note">
        <strong>Unofficial development prototype.</strong> This is not an
        official or approved Balochistan government service. All content is
        provisional placeholder text awaiting departmental approval and must not
        be relied upon as guidance, procedure or law.
      </p>

      <header className="public-header glass glass--strong">
        <div className="public-brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <p className="public-title">Transport Security &amp; Compliance</p>
            <p className="public-subtitle">
              Public information &middot; development preview
            </p>
          </div>
        </div>

        <nav className="public-nav" aria-label="Public information sections">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activeHref === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main-content" className="public-main">
        <article className="public-card glass">
          <h1>{title}</h1>
          <p className="public-lede">{intro}</p>
          {children}
        </article>
      </main>

      <footer className="public-footer glass">
        <span>
          Development prototype &middot; synthetic content &middot; not an
          official government service
        </span>
        <span>
          Administrative portal:{" "}
          <Link href="/login">restricted sign-in</Link>
        </span>
      </footer>
    </div>
  );
}
