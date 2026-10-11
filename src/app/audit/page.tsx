import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export const metadata: Metadata = { title: "Audit Trail" };

export default function AuditPage() {
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
