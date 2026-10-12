import { describe, expect, it } from "vitest";
import { hashIp } from "./audit";

describe("hashIp (privacy-preserving audit field)", () => {
  it("returns undefined for missing input", () => {
    expect(hashIp(null)).toBeUndefined();
    expect(hashIp(undefined)).toBeUndefined();
    expect(hashIp("")).toBeUndefined();
  });

  it("is deterministic so repeated events correlate", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
  });

  it("does NOT contain the raw IP address (non-reversible storage)", () => {
    const hash = hashIp("203.0.113.7");
    expect(hash).toBeDefined();
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).not.toContain("203");
  });

  it("produces different hashes for different IPs", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });
});
