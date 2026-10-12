import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";

export const metadata: Metadata = { title: "Audit Trail" };
// Auth-gated page: reads the session via headers(); render per-request.
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  return (
    <ModulePlaceholder
      icon="history"
      phase={6}
      title="Audit Trail"
      description="Review of who created, viewed, changed or exported sensitive records, with tamper-resistant storage and restricted access."
      bullets={[
        "Audit events for create, read-access of sensitive data, update, export and delete operations.",
        "Audit records are append-only: no in-app editing or deletion.",
        "Retention and legal-hold rules configurable only after an approved policy exists.",
      ]}
    />
  );
}
