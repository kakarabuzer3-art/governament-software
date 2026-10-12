import type { MetadataRoute } from "next";

/**
 * Sitemap — PUBLIC PAGES ONLY.
 *
 * The administrative portal, the APIs and every authenticated page are
 * deliberately excluded. Listing them would advertise private endpoints, and
 * they are not crawlable in any case because they require a session.
 */
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

const PUBLIC_PATHS = [
  "/info",
  "/info/guidance",
  "/info/permits",
  "/info/notices",
  "/info/faqs",
  "/info/contact",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: path === "/info" ? 1 : 0.6,
  }));
}
