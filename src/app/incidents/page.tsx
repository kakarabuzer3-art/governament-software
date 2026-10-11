import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return (
    <ModulePlaceholder
      icon="alertTriangle"
      phase={5}
      title="Incidents"
      description="Factual incident reports with assigned reviewers, documented status transitions and follow-up actions, protected by stricter permissions and auditing."
      bullets={[
        "Incident capture with factual observations, reviewer assignment and status tracking.",
        "No automated suspicion scoring, AI blacklists or enforcement decisions — determinations require authorized human processes.",
        "No NADRA, police or immigration integration without explicit departmental authorization.",
      ]}
    />
  );
}
