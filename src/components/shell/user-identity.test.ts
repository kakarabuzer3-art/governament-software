import { describe, expect, it } from "vitest";
import { describeRoles, initialsOf, ROLE_LABELS } from "./user-identity";

/**
 * Regression coverage for Phase 2 defect A on the rendering side: given the
 * identity the API now returns, the top bar must produce a real user name and
 * a human-readable role label instead of the "Not signed in" placeholder.
 */

describe("initialsOf", () => {
  it("uses up to two initials from a full name", () => {
    expect(initialsOf("Development Administrator")).toBe("DA");
    expect(initialsOf("Ayesha Khan")).toBe("AK");
  });

  it("copes with a single name", () => {
    expect(initialsOf("Administrator")).toBe("A");
  });

  it("collapses extra whitespace", () => {
    expect(initialsOf("  Ali   Raza  ")).toBe("AR");
  });

  it("never renders blank", () => {
    expect(initialsOf("")).toBe("U");
    expect(initialsOf("   ")).toBe("U");
  });
});

describe("describeRoles", () => {
  it("renders human labels for known role keys", () => {
    expect(describeRoles(["SYSTEM_ADMIN"])).toBe("System Administrator");
    expect(describeRoles(["OPERATOR_STAFF"])).toBe("Operator Staff");
    expect(describeRoles(["AUDITOR"])).toBe("Read-Only Auditor");
  });

  it("joins multiple roles", () => {
    expect(describeRoles(["SYSTEM_ADMIN", "AUDITOR"])).toBe(
      "System Administrator, Read-Only Auditor",
    );
  });

  it("shows an unknown role key verbatim rather than hiding it", () => {
    expect(describeRoles(["CUSTOM_ROLE"])).toBe("CUSTOM_ROLE");
  });

  it("degrades to a neutral label with no roles", () => {
    expect(describeRoles([])).toBe("Authenticated");
  });

  it("labels every provisional role", () => {
    for (const key of Object.keys(ROLE_LABELS)) {
      expect(describeRoles([key])).not.toBe("Authenticated");
    }
  });
});
