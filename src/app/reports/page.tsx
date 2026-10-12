import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";

export const metadata: Metadata = { title: "Reports" };
// Auth-gated page: reads the session via headers(); render per-request.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePermission(PERMISSIONS.REPORT_VIEW);
  return (
    <ModulePlaceholder
      icon="chart"
      phase={6}
      title="Reports"
      description="Date-wise and operator-wise reporting over real development-database data, with search, pagination and permission-aware PDF/CSV/Excel exports."
      bullets={[
        "Dashboard and reports connected to the database — no invented statistics.",
        "Date filters, search and pagination over journeys, manifests and compliance records.",
        "Exports restricted by the requesting user's permissions and recorded in the audit trail.",
      ]}
    />
  );
}
