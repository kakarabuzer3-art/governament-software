import { describe, expect, it } from "vitest";
import { csvCell, parseReportRange, toCsv } from "./reports";

/**
 * Reporting helpers (Phase 6). These are pure functions, so they are unit
 * tested without a database. The scope/permission behaviour of the report
 * itself is covered by the live-database integration tests.
 */

describe("parseReportRange", () => {
  it("returns an empty range for missing or invalid input", () => {
    expect(parseReportRange({})).toEqual({});
    expect(parseReportRange({ from: "not-a-date", to: "2026" })).toEqual({});
  });

  it("parses a valid from and to date", () => {
    const range = parseReportRange({ from: "2026-06-01", to: "2026-06-30" });
    expect(range.from?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    // `to` is inclusive: the whole of the final day is included.
    expect(range.to?.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("accepts repeated query parameters (first value wins)", () => {
    const range = parseReportRange({ from: ["2026-01-05", "2026-02-01"] });
    expect(range.from?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });
});

describe("csvCell", () => {
  it("passes simple values through", () => {
    expect(csvCell("Quetta")).toBe("Quetta");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    expect(csvCell("Quetta, Karachi")).toBe('"Quetta, Karachi"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("builds a header row and CRLF-terminated lines", () => {
    const csv = toCsv(
      ["operator_code", "journeys"],
      [
        ["OPR-1", 3],
        ["OPR-2", 0],
      ],
    );
    expect(csv).toBe(
      "operator_code,journeys\r\nOPR-1,3\r\nOPR-2,0\r\n",
    );
  });

  it("escapes a value that would otherwise break the columns", () => {
    const csv = toCsv(["name"], [['Bad, "name"']]);
    expect(csv).toContain('"Bad, ""name"""');
  });

  it("produces only a header row when there is no data", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});
