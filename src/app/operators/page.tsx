import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";

export const metadata: Metadata = { title: "Operators & Vehicles" };
// Auth-gated page: reads the session via headers(); render per-request.
export const dynamic = "force-dynamic";

export default async function OperatorsPage() {
  await requirePermission(PERMISSIONS.OPERATOR_VIEW);
  return (
    <ModulePlaceholder
      icon="users"
      phase={3}
      title="Operators & Vehicles"
      description="Controlled records for transport operators, vehicles, routes, terminals, drivers and permits, with relationships, validation and compliance history."
      bullets={[
        "Operator and vehicle records with uniqueness checks and server-side validation.",
        "Routes, terminals and permit records — permit status only from verified sources (pending departmental confirmation).",
        "Operator and vehicle compliance history with audit events for every change.",
      ]}
    />
  );
}
