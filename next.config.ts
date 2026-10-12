import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) is intentionally DISABLED for this application.
  //
  // Every protected route is authenticated and reads the user session via
  // headers() on each request, so no page can be statically prerendered.
  // Cache Components offers no benefit for a fully dynamic, session-gated
  // admin app and, in Next.js 16, forbids `export const dynamic =
  // "force-dynamic"` (which our authenticated pages rely on). Pages therefore
  // opt into explicit per-request rendering instead.
  cacheComponents: false,
  partialPrefetching: false,
};

export default nextConfig;

