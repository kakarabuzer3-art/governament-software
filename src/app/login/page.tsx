import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Sign in",
  // Never index the private sign-in screen.
  robots: { index: false, follow: false },
};

/**
 * Public sign-in screen. It deliberately does NOT render the app shell; it is
 * a standalone glass card over the shared geometric background. No public
 * registration is offered — this is a controlled-access system.
 */
export default function LoginPage() {
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
