import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Passenger guidance",
  description:
    "Provisional placeholder passenger guidance for intercity passenger transport. Unapproved development prototype content.",
  alternates: { canonical: "/info/guidance" },
};

/** Provisional guidance. Nothing here is presented as a legal requirement. */
export default function GuidancePage() {
  return (
    <PublicShell
      title="Passenger guidance"
      intro="General, non-authoritative guidance for passengers travelling on intercity services. The department has not yet approved any of this wording."
      activeHref="/info/guidance"
    >
      <h2>Before travelling</h2>
      <ul className="public-steps">
        <li>
          Carry a valid identity document if the operator&rsquo;s recorded
          procedure requires one.
        </li>
        <li>
          Confirm your departure point and time directly with the operator.
        </li>
        <li>
          Keep your booking or ticket reference available for the journey.
        </li>
      </ul>

      <h2>During the journey</h2>
      <ul className="public-steps">
        <li>
          Follow the instructions given by the operator&rsquo;s staff and by any
          posted notices at the terminal.
        </li>
        <li>
          Keep valuables with you and report anything that appears unsafe to the
          operator&rsquo;s staff.
        </li>
      </ul>

      <h2>Recording an observation</h2>
      <p>
        Where an operator records a passenger manifest, the details recorded are
        limited to what the approved procedure requires. In this prototype those
        fields are the passenger name, father&rsquo;s name, identity document
        number, permanent address and mobile number.
      </p>

      <h2>Status of this page</h2>
      <p>
        <span className="public-placeholder">Awaiting official approval</span>{" "}
        The final guidance text, its legal basis and its translations are to be
        supplied by the department. Do not rely on this page.
      </p>
    </PublicShell>
  );
}
