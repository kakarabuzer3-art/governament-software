import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact placeholders for this unapproved transport security and compliance development prototype.",
  alternates: { canonical: "/info/contact" },
};

/**
 * Contact page — PLACEHOLDERS ONLY.
 *
 * No postal address, telephone number, email address or office hours are
 * invented. Publishing a fabricated government contact point would be actively
 * harmful, so every value is explicitly marked as awaiting confirmation.
 */
export default function ContactPage() {
  return (
    <PublicShell
      title="Contact"
      intro="Contact details for the department will be published here once they have been confirmed. No contact details are invented on this page."
      activeHref="/info/contact"
    >
      <h2>Department contact</h2>
      <dl className="public-faq">
        <div>
          <dt>Responsible department</dt>
          <dd>
            <span className="public-placeholder">To be confirmed</span>
          </dd>
        </div>
        <div>
          <dt>Postal address</dt>
          <dd>
            <span className="public-placeholder">To be confirmed</span>
          </dd>
        </div>
        <div>
          <dt>Telephone</dt>
          <dd>
            <span className="public-placeholder">To be confirmed</span>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            <span className="public-placeholder">To be confirmed</span>
          </dd>
        </div>
        <div>
          <dt>Office hours</dt>
          <dd>
            <span className="public-placeholder">To be confirmed</span>
          </dd>
        </div>
      </dl>

      <h2>Access to the administrative portal</h2>
      <p>
        The administrative portal is restricted and is not open to public
        registration. Accounts are created by an administrator only. Requests
        for access must go through the responsible department once ownership of
        the system has been confirmed.
      </p>

      <h2>Reporting a problem with this page</h2>
      <p>
        This prototype is not monitored as a public service. Do not send real
        personal information, identity documents or credentials to any address
        associated with it.
      </p>
    </PublicShell>
  );
}
