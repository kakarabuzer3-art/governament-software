import { describe, expect, it } from "vitest";
import {
  demoActivity,
  demoCctvStatus,
  demoJourneys,
  demoStats,
} from "./demo-data";

describe("demo data (synthetic)", () => {
  it("has unique ids in every collection", () => {
    const collections = [demoJourneys, demoActivity, demoCctvStatus];
    for (const rows of collections) {
      const ids = rows.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const statIds = demoStats.map((stat) => stat.id);
    expect(new Set(statIds).size).toBe(statIds.length);
  });

  it("marks every journey trip reference as demo data", () => {
    for (const journey of demoJourneys) {
      expect(journey.tripRef.startsWith("TRP-DEMO-")).toBe(true);
    }
  });

  it("labels every statistic as a sample value", () => {
    for (const stat of demoStats) {
      expect(stat.hint.toLowerCase()).toContain("sample");
    }
  });

  it("contains no 13-digit sequences that could resemble a CNIC", () => {
    const serialized = JSON.stringify({
      demoJourneys,
      demoActivity,
      demoCctvStatus,
      demoStats,
    });
    expect(serialized).not.toMatch(/\d{13}/);
  });

  it("uses only valid status values", () => {
    for (const journey of demoJourneys) {
      expect(["scheduled", "boarding", "arrived"]).toContain(journey.status);
      expect(["complete", "partial"]).toContain(journey.manifest);
    }
  });
});
