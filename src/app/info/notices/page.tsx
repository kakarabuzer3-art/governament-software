import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Security notices",
  description:
    "Public security notices area. No notices have been approved for publication in this development prototype.",
  alternates: { canonical: "/info/notices" },
};

/**
 * Public security notices — deliberately EMPTY.
 *
 * No notice content is invented. The page renders an honest empty state until
 * the department supplies approved notices.
 */
export default function NoticesPage() {
  return (
    <PublicShell
      title="Security notices"
      intro="Official public notices will appear here once they have been approved for publication."
      activeHref="/info/notices"
    >
      <h2>Current notices</h2>
      <div className="empty-state" role="status">
        <p className="empty-state-title">No notices have been published</p>
        <p className="empty-state-text">
          No security notice has been approved for publication in this
          prototype, so none is shown. Placeholder notices would risk being
          mistaken for official guidance, and have deliberately been omitted.
        </p>
      </div>

      <h2>How notices will be handled</h2>
      <ul className="public-steps">
        <li>Each notice will carry an issuing authority and a publication date.</li>
        <li>Superseded notices will be marked as withdrawn, not deleted.</li>
        <li>Only content approved by the department will be published.</li>
      </ul>
    </PublicShell>
  );
}
