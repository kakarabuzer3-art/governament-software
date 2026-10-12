import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT_TARGET, safeNextTarget } from "./safe-redirect";

/**
 * Regression test for Phase 2 defect D — open-redirect protection.
 *
 * The previous inline check only rejected values not starting with "/" and
 * values starting with "//". Because browsers normalise a backslash to a
 * forward slash, `next=/\evil.test` still produced an external redirect.
 * These cases pin the hardened behaviour.
 */

describe("safeNextTarget", () => {
  it("keeps ordinary same-origin paths", () => {
    expect(safeNextTarget("/")).toBe("/");
    expect(safeNextTarget("/operators")).toBe("/operators");
    expect(safeNextTarget("/operators?status=ACTIVE&page=2")).toBe(
      "/operators?status=ACTIVE&page=2",
    );
    expect(safeNextTarget("/permits#results")).toBe("/permits#results");
  });

  it("trims surrounding whitespace", () => {
    expect(safeNextTarget("  /routes  ")).toBe("/routes");
  });

  it("falls back to / for missing or empty input", () => {
    expect(safeNextTarget(null)).toBe(DEFAULT_REDIRECT_TARGET);
    expect(safeNextTarget(undefined)).toBe(DEFAULT_REDIRECT_TARGET);
    expect(safeNextTarget("")).toBe(DEFAULT_REDIRECT_TARGET);
    expect(safeNextTarget("   ")).toBe(DEFAULT_REDIRECT_TARGET);
  });

  it("rejects protocol-relative targets", () => {
    expect(safeNextTarget("//evil.test")).toBe("/");
    expect(safeNextTarget("//evil.test/path")).toBe("/");
  });

  it("rejects backslash-normalised targets (defect D)", () => {
    expect(safeNextTarget("/\\evil.test")).toBe("/");
    expect(safeNextTarget("/\\/evil.test")).toBe("/");
    expect(safeNextTarget("\\evil.test")).toBe("/");
    expect(safeNextTarget("/path\\to")).toBe("/");
  });

  it("rejects absolute URLs and non-http schemes", () => {
    expect(safeNextTarget("https://evil.test")).toBe("/");
    expect(safeNextTarget("http://evil.test/login")).toBe("/");
    expect(safeNextTarget("javascript:alert(1)")).toBe("/");
    expect(safeNextTarget("data:text/html,<script>alert(1)</script>")).toBe("/");
    expect(safeNextTarget("mailto:a@b.test")).toBe("/");
  });

  it("rejects control characters that browsers strip or reinterpret", () => {
    expect(safeNextTarget("/\t/evil.test")).toBe("/");
    expect(safeNextTarget("/\n/evil.test")).toBe("/");
    expect(safeNextTarget("/\r\n/evil.test")).toBe("/");
    expect(safeNextTarget("/\u0000/evil.test")).toBe("/");
  });

  it("rejects bare relative segments", () => {
    expect(safeNextTarget("operators")).toBe("/");
    expect(safeNextTarget("../admin")).toBe("/");
  });

  it("normalises traversal inside the same origin", () => {
    // "/../admin" resolves inside the sentinel origin, so it stays internal.
    expect(safeNextTarget("/../operators")).toBe("/operators");
  });
});
