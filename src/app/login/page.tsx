import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { Icon } from "@/components/ui/icons";
import { BackgroundSwitcher } from "@/components/shell/BackgroundManager";
import { getCurrentUser } from "@/lib/authorization";
import { safeNextTarget } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Sign in",
  // Never index the private sign-in screen.
  robots: { index: false, follow: false },
};

// Reads the session via headers(), so it must render per-request.
export const dynamic = "force-dynamic";

/**
 * Public sign-in screen. It deliberately does NOT render the app shell; it is
 * a standalone glass card over the shared geometric background. No public
 * registration is offered — this is a controlled-access system.
 *
 * PHASE 2 DEFECT C: the "already signed in? go to the dashboard" redirect lives
 * HERE, not in `proxy.ts`. The proxy only knows whether a cookie exists; this
 * page verifies the session against the database, so a stale or revoked cookie
 * is correctly treated as signed out and the login form is shown instead of
 * ping-ponging between `/login` and `/`.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const params = await searchParams;
    const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
    redirect(safeNextTarget(rawNext));
  }

  return (
    <main id="main-content" className="login-screen">
      <section className="login-card glass glass--strong" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="shield" size={22} />
          </span>
          <div>
            <h1 className="login-title" id="login-title">
              Transport Security &amp; Compliance
            </h1>
            <p className="login-subtitle">
              Restricted administrative sign-in &middot; development preview
            </p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <BackgroundSwitcher />
          </div>
        </div>

        <Suspense fallback={<p className="login-help">Loading sign-in…</p>}>
          <LoginForm />
        </Suspense>

        <p className="login-footer">
          Unapproved development project using synthetic data. Not an official
          government service.
        </p>
      </section>
    </main>
  );
}
