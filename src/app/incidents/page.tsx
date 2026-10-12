import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";

export const metadata: Metadata = { title: "Incidents" };
// Auth-gated page: reads the session via headers(); render per-request.
export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  await requirePermission(PERMISSIONS.INCIDENT_VIEW);
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
