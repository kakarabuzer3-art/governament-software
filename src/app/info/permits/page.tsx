import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Permit procedures",
  description:
    "Provisional, unapproved description of how transport permits are recorded in this development prototype.",
  alternates: { canonical: "/info/permits" },
};

/**
 * Permit procedures — PLACEHOLDER.
 *
 * This page deliberately describes only how the PROTOTYPE records permits. It
 * does not state any legal requirement, fee, form or deadline, because none has
 * been confirmed by the department and inventing them would be misleading.
 */
export default function PermitsPage() {
  return (
    <PublicShell
      title="Permit procedures"
      intro="How permit records are entered in this prototype — and what that does and does not mean."
      activeHref="/info/permits"
    >
      <h2>Important limitation</h2>
      <p>
        The prototype stores a <strong>recorded</strong> permit status together
        with a note of where that status came from. It does not verify a permit
        against any government source, and a status shown here is not evidence
        that a permit is valid.
      </p>
      <p>
        <span className="public-placeholder">Awaiting official approval</span>{" "}
        The real application procedure, required documents, fees, validity
        periods and issuing authority are to be confirmed by the department.
        This page does not describe them and must not be treated as guidance.
      </p>

      <h2>What the prototype records</h2>
      <ul className="public-steps">
        <li>The permit number exactly as entered by an authorised user.</li>
        <li>The operator it relates to, and optionally a vehicle and route.</li>
        <li>Recorded issue and expiry dates, where they are known.</li>
        <li>
          A recorded status (for example pending, active, expired, suspended or
          revoked) and the source of that status.
        </li>
        <li>An audit event for every change made by an administrator.</li>
      </ul>

      <h2>Who can change a permit record</h2>
      <p>
        Permit records can only be created or amended by signed-in users whose
        role permits it. Operator staff can only see records belonging to the
        operator they are assigned to; read-only auditors cannot change
        anything.
      </p>
    </PublicShell>
  );
}
