import { describe, expect, it } from "vitest";
import {
  canAccessOperator,
  operatorFilter,
  operatorIdFilter,
  resolveOperatorScope,
} from "./scope";

/**
 * Operator data isolation (Phase 3) — the security-critical rule that a role
 * alone must never reveal another operator's records.
 */

describe("resolveOperatorScope", () => {
  it("treats department-wide roles as unrestricted", () => {
    for (const role of ["SYSTEM_ADMIN", "DEPARTMENT_OFFICER", "AUDITOR"]) {
      const scope = resolveOperatorScope({ roles: [role], operatorIds: ["op-1"] });
      expect(scope.unrestricted).toBe(true);
      expect(scope.operatorIds).toEqual([]);
    }
  });

  it("restricts operator staff to their explicit assignments", () => {
    const scope = resolveOperatorScope({
      roles: ["OPERATOR_STAFF"],
      operatorIds: ["op-1", "op-2"],
    });
    expect(scope.unrestricted).toBe(false);
    expect(scope.operatorIds).toEqual(["op-1", "op-2"]);
  });

  it("gives an UNASSIGNED operator account no scope at all (fail-closed)", () => {
    const scope = resolveOperatorScope({ roles: ["OPERATOR_STAFF"] });
    expect(scope.unrestricted).toBe(false);
    expect(scope.operatorIds).toEqual([]);
    // An empty operator list must match nothing, not everything.
    expect(operatorFilter(scope)).toEqual({ operatorId: { in: [] } });
    expect(operatorIdFilter(scope)).toEqual({ id: { in: [] } });
  });

  it("gives a user with NO roles no scope", () => {
    const scope = resolveOperatorScope({ roles: [], operatorIds: ["op-1"] });
    expect(scope.unrestricted).toBe(false);
    expect(scope.operatorIds).toEqual(["op-1"]);
  });
});

describe("canAccessOperator", () => {
  it("allows anything for an unrestricted scope", () => {
    const scope = resolveOperatorScope({ roles: ["SYSTEM_ADMIN"] });
    expect(canAccessOperator(scope, "any-operator")).toBe(true);
  });

  it("allows only assigned operators for a restricted scope", () => {
    const scope = resolveOperatorScope({
      roles: ["OPERATOR_STAFF"],
      operatorIds: ["op-1"],
    });
    expect(canAccessOperator(scope, "op-1")).toBe(true);
    expect(canAccessOperator(scope, "op-2")).toBe(false);
  });

  it("denies everything for an unassigned operator account", () => {
    const scope = resolveOperatorScope({ roles: ["OPERATOR_STAFF"] });
    expect(canAccessOperator(scope, "op-1")).toBe(false);
  });
});

describe("query filters", () => {
  it("adds no filter for unrestricted scopes", () => {
    const scope = resolveOperatorScope({ roles: ["DEPARTMENT_OFFICER"] });
    expect(operatorFilter(scope)).toEqual({});
    expect(operatorIdFilter(scope)).toEqual({});
  });

  it("restricts by the assigned operator ids otherwise", () => {
    const scope = resolveOperatorScope({
      roles: ["OPERATOR_STAFF"],
      operatorIds: ["op-1", "op-3"],
    });
    expect(operatorFilter(scope)).toEqual({
      operatorId: { in: ["op-1", "op-3"] },
    });
    expect(operatorIdFilter(scope)).toEqual({ id: { in: ["op-1", "op-3"] } });
  });
});
