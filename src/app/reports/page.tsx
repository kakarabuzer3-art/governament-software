import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
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
