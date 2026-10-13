import type { MetadataRoute } from "next";

/**
 * Crawler rules.
 *
 * The ADMINISTRATIVE PORTAL must never be indexed. Only the public `/info`
 * surface is opened to crawlers. Because "allow /info" and "disallow /" both
 * apply, the more specific rule wins for crawlers that follow the standard —
 * but the primary protection is that the admin area requires a session, and
 * robots rules are a politeness signal, not a security control.
 */
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/info"],
        disallow: [
          "/",
          "/api/",
          "/login",
          "/forbidden",
          "/operators",
          "/vehicles",
          "/routes",
          "/permits",
          "/trips",
          "/inspections",
          "/incidents",
          "/reports",
          "/audit",
          "/settings",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
