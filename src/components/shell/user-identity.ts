/**
 * Pure display helpers for the top-bar identity panel.
 *
 * These were extracted from `UserTopBar` so the "does an authenticated user's
 * identity actually render correctly?" behaviour can be regression-tested in
 * Vitest without a DOM/test-renderer dependency (Phase 2 defect A).
 */

/** Human-readable labels for the provisional role keys. */
export const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  DEPARTMENT_OFFICER: "Department Officer",
  OPERATOR_STAFF: "Operator Staff",
  AUDITOR: "Read-Only Auditor",
};

/**
 * Up to two uppercase initials for the avatar circle. Falls back to "U" when
 * the name is empty or whitespace so the control never renders blank.
 */
export function initialsOf(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "U";
}

/**
 * Comma-separated role labels. Unknown role keys are shown verbatim (never
 * hidden) and an empty role list degrades to the neutral "Authenticated".
 */
export function describeRoles(roles: readonly string[]): string {
  const labels = roles
    .map((role) => ROLE_LABELS[role] ?? role)
    .filter((label) => label.length > 0);
  return labels.length > 0 ? labels.join(", ") : "Authenticated";
}
