import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";

export const metadata: Metadata = { title: "Settings" };
// Auth-gated page: reads the session via headers(); render per-request.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission(PERMISSIONS.USER_VIEW);
  return (
    <ModulePlaceholder
      icon="settings"
      phase={6}
      title="Settings"
      description="Roles, permissions, retention configuration and system preferences. Changes here affect security, so every edit will be audited."
      bullets={[
        "Role and permission management (roles themselves pending departmental confirmation).",
        "Retention policy configuration — automatic cleanup stays disabled until the policy is officially approved.",
        "Language foundations for English, Urdu, Pashto and Balochi with correct right-to-left layout.",
      ]}
    />
  );
}
