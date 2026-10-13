import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { PUBLIC_NAV, PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Public transport information",
  description:
    "Provisional placeholder information about passenger transport security and permit procedures. This is an unapproved development prototype, not an official government service.",
  alternates: { canonical: "/info" },
};

/**
 * Public information hub.
 *
 * The content is intentionally honest: it explains what this prototype is,
 * states clearly that nothing here is approved, and links only to other public
 * pages. No official procedure, address or legal rule is invented.
 */
export default function PublicInfoPage() {
  return (
    <PublicShell
      title="Passenger transport information"
      intro="A placeholder public information area for a proposed passenger transport security and compliance workflow. Every section below is provisional and awaiting official approval."
      activeHref="/info"
    >
      <p className="public-banner" role="note">
        <Icon name="info" size={15} /> Nothing on this site has been approved by
        the department. Treat it as a layout demonstration only.
      </p>

      <h2>What this prototype is</h2>
      <p>
        This is a development prototype built to explore how a transport
        security and compliance workflow could be organised. It records
        operators, vehicles, routes, permits, journeys, passenger manifests,
        CCTV inspection observations and incident reports using synthetic test
        data.
      </p>

      <h2>What this prototype is not</h2>
      <ul className="public-steps">
        <li>It is not an official or endorsed government service.</li>
        <li>
          It is not connected to any government database, permit authority,
          police, immigration or identity service.
        </li>
        <li>
          It contains no real passenger records, and no real identity numbers.
        </li>
        <li>
          It does not perform automated verification, scoring, watchlisting or
          enforcement of any kind.
        </li>
      </ul>

      <h2>Sections</h2>
      <ul className="public-section-links">
        {PUBLIC_NAV.filter((item) => item.href !== "/info").map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <strong>{item.label}</strong>
              <span>Provisional placeholder content</span>
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  );
}
