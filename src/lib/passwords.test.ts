import { describe, expect, it } from "vitest";
import {
  describePasswordPolicy,
  FORBIDDEN_PLACEHOLDER_PASSWORDS,
  generateInitialPassword,
  isAcceptablePassword,
  MIN_PASSWORD_LENGTH,
  passwordPolicyError,
} from "./passwords";

/**
 * Password policy and generator (Phase B). An initial credential is generated
 * server-side when the administrator does not supply one, so the generator must
 * always produce something that satisfies the policy.
 */

describe("passwordPolicyError", () => {
  it("requires a password", () => {
    expect(passwordPolicyError("")).toMatch(/required/i);
  });

  it("enforces the minimum length", () => {
    expect(passwordPolicyError("a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(
      /at least/i,
    );
    expect(passwordPolicyError("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("enforces a maximum length", () => {
    expect(passwordPolicyError("a".repeat(200))).toMatch(/at most/i);
  });

  it("refuses well-known placeholders regardless of case", () => {
    for (const placeholder of FORBIDDEN_PLACEHOLDER_PASSWORDS) {
      expect(passwordPolicyError(placeholder.toUpperCase())).toMatch(
        /placeholder/i,
      );
    }
  });

  it("never echoes the rejected password", () => {
    const secret = "hunter2-hunter2";
    const message = passwordPolicyError(secret) ?? "";
    expect(message).not.toContain(secret);
  });

  it("accepts a strong value", () => {
    expect(isAcceptablePassword("Qu3tta-Roads!2026")).toBe(true);
  });
});

describe("generateInitialPassword", () => {
  it("always satisfies the policy", () => {
    for (let i = 0; i < 50; i++) {
      const generated = generateInitialPassword();
      expect(passwordPolicyError(generated)).toBeNull();
      expect(generated.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    }
  });

  it("honours a requested length but never goes below the minimum", () => {
    expect(generateInitialPassword(32)).toHaveLength(32);
    expect(generateInitialPassword(4).length).toBeGreaterThanOrEqual(
      MIN_PASSWORD_LENGTH,
    );
  });

  it("includes several character classes", () => {
    const generated = generateInitialPassword(24);
    expect(/[A-Z]/.test(generated)).toBe(true);
    expect(/[a-z]/.test(generated)).toBe(true);
    expect(/[0-9]/.test(generated)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(generated)).toBe(true);
  });

  it("does not repeat in practice", () => {
    const values = new Set(
      Array.from({ length: 100 }, () => generateInitialPassword()),
    );
    expect(values.size).toBe(100);
  });
});

describe("describePasswordPolicy", () => {
  it("states the rules without claiming legal authority", () => {
    const text = describePasswordPolicy();
    expect(text).toContain(String(MIN_PASSWORD_LENGTH));
    expect(text).not.toMatch(/legal|official|government/i);
  });
});
