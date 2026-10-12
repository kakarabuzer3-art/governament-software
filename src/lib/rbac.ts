/**
 * Provisional role-based access control (RBAC) definition.
 *
 * IMPORTANT: These roles and permissions are proposed technical constructs
 * only. They are NOT confirmed government policy. The department must approve
 * its final access matrix before any of this is treated as authoritative.
 * Every permission below is therefore "provisional" until that approval.
 *
 * Design rules enforced elsewhere in the codebase:
 *  - Access is DENIED by default: a user has a capability only if one of their
 *    roles grants it.
 *  - Permissions are only ever evaluated on the server from database state,
 *    never from client-supplied input.
 */

/** Every discrete capability in the system (Phase 2 scope + placeholders). */
export const PERMISSIONS = {
  // Dashboard / read overview
  DASHBOARD_VIEW: "dashboard.view",
  // User & access administration
  USER_VIEW: "user.view",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  // Audit
  AUDIT_VIEW: "audit.view",
  // Operational modules (granted now so role wiring is stable; enforced when
  // those modules land in later phases)
  OPERATOR_VIEW: "operator.view",
  TRIP_VIEW: "trip.view",
  INSPECTION_VIEW: "inspection.view",
  INCIDENT_VIEW: "incident.view",
  REPORT_VIEW: "report.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Machine keys for the provisional roles. */
export const ROLES = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  DEPARTMENT_OFFICER: "DEPARTMENT_OFFICER",
  OPERATOR_STAFF: "OPERATOR_STAFF",
  AUDITOR: "AUDITOR",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}

/**
 * The provisional permission matrix. SYSTEM_ADMIN intentionally receives the
 * administration capabilities (user/role management); the operational roles
 * receive read-only visibility appropriate to their remit. No ordinary role can
 * grant itself permissions — that is enforced server-side, not here.
 */
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: ROLES.SYSTEM_ADMIN,
    name: "System Administrator",
    description:
      "Full technical administration: users, roles and audit review. " +
      "Provisional — not a confirmed government policy role.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.OPERATOR_VIEW,
      PERMISSIONS.TRIP_VIEW,
      PERMISSIONS.INSPECTION_VIEW,
      PERMISSIONS.INCIDENT_VIEW,
      PERMISSIONS.REPORT_VIEW,
    ],
  },
  {
    key: ROLES.DEPARTMENT_OFFICER,
    name: "Department Officer",
    description:
      "Departmental oversight of transport operations and compliance. " +
      "Provisional — not a confirmed government policy role.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.OPERATOR_VIEW,
      PERMISSIONS.TRIP_VIEW,
      PERMISSIONS.INSPECTION_VIEW,
      PERMISSIONS.INCIDENT_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
  {
    key: ROLES.OPERATOR_STAFF,
    name: "Transport Operator Staff",
    description:
      "Terminal / operator staff handling their own journeys. " +
      "Provisional — not a confirmed government policy role.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.OPERATOR_VIEW,
      PERMISSIONS.TRIP_VIEW,
    ],
  },
  {
    key: ROLES.AUDITOR,
    name: "Read-Only Auditor",
    description:
      "Read-only compliance review across the system. Provisional.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.OPERATOR_VIEW,
      PERMISSIONS.TRIP_VIEW,
      PERMISSIONS.INSPECTION_VIEW,
      PERMISSIONS.INCIDENT_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
];

/** Permission required to view the main dashboard. */
export const PERMISSION_DASHBOARD_VIEW = PERMISSIONS.DASHBOARD_VIEW;
