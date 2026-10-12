import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "./rbac";
import { ROLES, ROLE_DEFINITIONS } from "./rbac";
import type { PermissionKey } from "./rbac";

/**
 * Unit tests for the provisional RBAC role/permission definitions.
 *
 * These prove the permission matrix is internally consistent: the system
 * administrator holds administration capabilities, no other role is granted
 * write/administration rights, and the read-only auditor is free of them.
 */

describe("RBAC role permissions", () => {
  it("gives SYSTEM_ADMIN the user/role administration permissions", () => {
    const admin = ROLE_DEFINITIONS.find(
      (role) => role.key === ROLES.SYSTEM_ADMIN,
    );
    expect(admin).toBeDefined();
    expect(admin?.permissions).toContain(PERMISSIONS.USER_MANAGE);
    expect(admin?.permissions).toContain(PERMISSIONS.ROLE_MANAGE);
  });

  it("does NOT give any non-admin role user or role management rights", () => {
    const privileged = [PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE];
    for (const role of ROLE_DEFINITIONS) {
      if (role.key === ROLES.SYSTEM_ADMIN) continue;
      for (const permission of privileged) {
        expect(
          role.permissions.includes(permission),
          role.key + " unexpectedly holds " + permission,
        ).toBe(false);
      }
    }
  });

  it("keeps the read-only auditor free of write/administration permissions", () => {
    const auditor = ROLE_DEFINITIONS.find(
      (role) => role.key === ROLES.AUDITOR,
    );
    expect(auditor).toBeDefined();
    expect(auditor?.permissions).not.toContain(PERMISSIONS.USER_MANAGE);
    expect(auditor?.permissions).not.toContain(PERMISSIONS.ROLE_MANAGE);
    // Auditor can at least view dashboards and the audit trail.
    expect(auditor?.permissions).toContain(PERMISSIONS.AUDIT_VIEW);
    expect(auditor?.permissions).toContain(PERMISSIONS.DASHBOARD_VIEW);
  });

  it("uses unique role keys and unique permission keys", () => {
    const roleKeys = ROLE_DEFINITIONS.map((r) => r.key);
    expect(new Set(roleKeys).size).toBe(roleKeys.length);

    const allPermissions = new Set<PermissionKey>();
    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        allPermissions.add(permission);
      }
    }
    // Every permission referenced by a role is a known PERMISSIONS value.
    for (const permission of allPermissions) {
      expect(Object.values(PERMISSIONS)).toContain(permission);
    }
  });

  it("references only known role keys", () => {
    for (const key of Object.values(ROLES)) {
      const found = ROLE_DEFINITIONS.find((r) => r.key === key);
      expect(found, "missing definition for role " + key).toBeDefined();
    }
  });
});
