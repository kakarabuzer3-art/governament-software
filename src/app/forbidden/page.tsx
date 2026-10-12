import type { Metadata } from "next";
import { Icon } from "@/components/ui/icons";
import { requireAuthenticatedUser } from "@/lib/authorization";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};
// Auth-gated page: reads the session via headers(); render per-request.
export const dynamic = "force-dynamic";

/**
 * Shown when an authenticated user reaches something their role does not
 * permit. We still require a valid session here so a raw unauthenticated hit
 * is redirected to login instead of learning this page exists.
 */
export default async function ForbiddenPage() {
  const user = await requireAuthenticatedUser();

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Access denied</h2>
          <p className="page-description">
            You are signed in as {user.name}, but your role does not grant
            access to this area.
          </p>
        </div>
      </header>

      <section className="panel glass">
      <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true">
          <Icon name="alertTriangle" size={24} />
        </span>
        <h3 className="empty-state-title">You don&rsquo;t have permission</h3>
        <p className="empty-state-text">
          Access is granted by role and enforced on the server. If you believe
          you need access, ask a system administrator to review your assigned
          roles. Your current roles: {user.roles.join(", ") || "none"}.
        </p>
      </div>
    </section>
    </>
  );
}
