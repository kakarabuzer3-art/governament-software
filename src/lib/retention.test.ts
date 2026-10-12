import { describe, expect, it } from "vitest";
import {
  configuredRetentionDays,
  describeRetentionPolicy,
  isWithinMinimumRetention,
  retentionDueAt,
  RETENTION_POLICY,
} from "./retention";

describe("retention policy", () => {
  it("never claims automatic deletion", () => {
    expect(RETENTION_POLICY.AUTOMATIC_DELETION_ENABLED).toBe(false);
  });

  it("uses the stated 10-day minimum by default", () => {
    expect(configuredRetentionDays(undefined)).toBe(10);
  });

  it("refuses to go below the minimum", () => {
    expect(configuredRetentionDays("3")).toBe(10);
    expect(configuredRetentionDays("-100")).toBe(10);
  });

  it("accepts a longer configured period", () => {
    expect(configuredRetentionDays("30")).toBe(30);
  });

  it("caps absurd values", () => {
    expect(configuredRetentionDays("999999")).toBe(RETENTION_POLICY.MAX_DAYS);
  });

  it("ignores non-numeric configuration", () => {
    expect(configuredRetentionDays("forever")).toBe(10);
  });

  it("computes the due instant", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    expect(retentionDueAt(created, 10).toISOString()).toBe(
      "2026-01-11T00:00:00.000Z",
    );
  });

  it("reports whether a record is still inside minimum retention", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    expect(
      isWithinMinimumRetention(created, new Date("2026-01-05T00:00:00.000Z")),
    ).toBe(true);
    expect(
      isWithinMinimumRetention(created, new Date("2026-02-01T00:00:00.000Z")),
    ).toBe(false);
  });

  it("describes the policy honestly", () => {
    const description = describeRetentionPolicy();
    expect(description).toContain("10 days");
    expect(description).toContain("DISABLED");
  });
});
