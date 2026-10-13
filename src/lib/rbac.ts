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
 *  - Holding a permission is necessary but not always sufficient: operator
 *    staff are additionally scoped to their assigned operators
 *    (see src/lib/transport/scope.ts).
 */

/** Every discrete capability in the system. */
export const PERMISSIONS = {
  // Dashboard / read overview
  DASHBOARD_VIEW: "dashboard.view",
  // User & access administration (administrator-only)
  USER_VIEW: "user.view",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  // Audit
  AUDIT_VIEW: "audit.view",
  // Phase 3 — transport records
  OPERATOR_VIEW: "operator.view",
  OPERATOR_MANAGE: "operator.manage",
  VEHICLE_VIEW: "vehicle.view",
  VEHICLE_MANAGE: "vehicle.manage",
  ROUTE_VIEW: "route.view",
  ROUTE_MANAGE: "route.manage",
  PERMIT_VIEW: "permit.view",
  PERMIT_MANAGE: "permit.manage",
  // Phase 4 — trips and passenger manifests
  TRIP_VIEW: "trip.view",
  TRIP_MANAGE: "trip.manage",
  /** Reading passenger identity data is a separate, sensitive capability. */
  MANIFEST_VIEW: "manifest.view",
  MANIFEST_MANAGE: "manifest.manage",
  // Phase 5 — compliance
  INSPECTION_VIEW: "inspection.view",
  INSPECTION_MANAGE: "inspection.manage",
  INCIDENT_VIEW: "incident.view",
  INCIDENT_MANAGE: "incident.manage",
  // Phase 6 — oversight
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
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

const {
  DASHBOARD_VIEW,
  USER_VIEW,
  USER_MANAGE,
  ROLE_MANAGE,
  AUDIT_VIEW,
  OPERATOR_VIEW,
  OPERATOR_MANAGE,
  VEHICLE_VIEW,
  VEHICLE_MANAGE,
  ROUTE_VIEW,
  ROUTE_MANAGE,
  PERMIT_VIEW,
  PERMIT_MANAGE,
  TRIP_VIEW,
  TRIP_MANAGE,
  MANIFEST_VIEW,
  MANIFEST_MANAGE,
  INSPECTION_VIEW,
  INSPECTION_MANAGE,
  INCIDENT_VIEW,
  INCIDENT_MANAGE,
  REPORT_VIEW,
  REPORT_EXPORT,
} = PERMISSIONS;

/** Every read-only capability, used to build the auditor role. */
const READ_ONLY_PERMISSIONS: readonly PermissionKey[] = [
  DASHBOARD_VIEW,
  AUDIT_VIEW,
  OPERATOR_VIEW,
  VEHICLE_VIEW,
  ROUTE_VIEW,
  PERMIT_VIEW,
  TRIP_VIEW,
  MANIFEST_VIEW,
  INSPECTION_VIEW,
  INCIDENT_VIEW,
  REPORT_VIEW,
];

/**
 * The provisional permission matrix. SYSTEM_ADMIN intentionally holds the
 * administration capabilities (user/role management); no ordinary role can
 * grant itself permissions. Auditors are strictly read-only — they receive no
 * manage permission and no export capability.
 */
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: ROLES.SYSTEM_ADMIN,
    name: "System Administrator",
    description:
      "Full technical administration: users, roles and audit review. " +
      "Provisional — not a confirmed government policy role.",
    permissions: [
      ...READ_ONLY_PERMISSIONS,
      USER_VIEW,
      USER_MANAGE,
      ROLE_MANAGE,
      OPERATOR_MANAGE,
      VEHICLE_MANAGE,
      ROUTE_MANAGE,
      PERMIT_MANAGE,
      TRIP_MANAGE,
      MANIFEST_MANAGE,
      INSPECTION_MANAGE,
      INCIDENT_MANAGE,
      REPORT_EXPORT,
    ],
  },
  {
    key: ROLES.DEPARTMENT_OFFICER,
    name: "Department Officer",
    description:
      "Departmental oversight of transport operations and compliance, with " +
      "authority to manage records. Provisional — not a confirmed role.",
    permissions: [
      ...READ_ONLY_PERMISSIONS,
      OPERATOR_MANAGE,
      VEHICLE_MANAGE,
      ROUTE_MANAGE,
      PERMIT_MANAGE,
      TRIP_MANAGE,
      MANIFEST_MANAGE,
      INSPECTION_MANAGE,
      INCIDENT_MANAGE,
      REPORT_EXPORT,
    ],
  },
  {
    key: ROLES.OPERATOR_STAFF,
    name: "Transport Operator Staff",
    description:
      "Terminal / operator staff handling their own operator's journeys. " +
      "Additional per-operator scoping is enforced server-side. Provisional.",
    permissions: [
      DASHBOARD_VIEW,
      OPERATOR_VIEW,
      VEHICLE_VIEW,
      ROUTE_VIEW,
      PERMIT_VIEW,
      TRIP_VIEW,
      TRIP_MANAGE,
      MANIFEST_VIEW,
      MANIFEST_MANAGE,
      INSPECTION_VIEW,
    ],
  },
  {
    key: ROLES.AUDITOR,
    name: "Read-Only Auditor",
    description:
      "Read-only compliance review across the system. Holds no management " +
      "and no export capability. Provisional.",
    permissions: [...READ_ONLY_PERMISSIONS],
  },
];

/**
 * Roles that are NOT restricted to specific operators. Anyone holding one of
 * these roles operates department-wide; everyone else is scoped to their
 * explicit `user_operator` assignments.
 */
export const DEPARTMENT_WIDE_ROLES: readonly RoleKey[] = [
  ROLES.SYSTEM_ADMIN,
  ROLES.DEPARTMENT_OFFICER,
  ROLES.AUDITOR,
];

/** Permission required to view the main dashboard. */
export const PERMISSION_DASHBOARD_VIEW = PERMISSIONS.DASHBOARD_VIEW;
