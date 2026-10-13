import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/public.css";

/**
 * Layout for the public information site.
 *
 * The public surface is anonymous, indexable and separate from the
 * administrative portal. It reuses the mandated design tokens and the global
 * geometric background, and deliberately has no dependency on the admin shell.
 */
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  // Public content MAY be indexed (the admin portal may not; see robots.ts).
  robots: { index: true, follow: true },
  title: {
    default: "Transport information (development preview)",
    template: "%s - Transport information preview",
  },
};

export default function PublicInfoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
