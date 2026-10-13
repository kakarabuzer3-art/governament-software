import { describe, expect, it } from "vitest";
import {
  evaluateLoginRateLimit,
  LOGIN_RATE_LIMITS,
  describeLoginRateLimitPolicy,
  type WindowStats,
} from "./auth-rate-limit";

/**
 * Login rate-limit policy (Phase C / GAP-04) — pure decision logic.
 *
 * The I/O half (the ledger) is exercised by the live-database and live-HTTP
 * checks; these tests pin the SECURITY SEMANTICS, in particular that an
 * attacker cannot lock a legitimate user out when no trustworthy client
 * address is available.
 */

const now = new Date("2026-10-13T10:00:00.000Z");
const minutesAgo = (minutes: number): Date =>
  new Date(now.getTime() - minutes * 60_000);

const empty: WindowStats = { count: 0, oldestAt: null };
const failures = (count: number, oldestMinutesAgo = 1): WindowStats => ({
  count,
  oldestAt: minutesAgo(oldestMinutesAgo),
});

describe("evaluateLoginRateLimit — with a trusted client address", () => {
  const base = { now, hasClientAddress: true };

  it("allows activity below every threshold", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: failures(4),
      identifierOnly: failures(4),
      ip: failures(10),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterSeconds).toBe(0);
    expect(decision.delayMs).toBe(0);
  });

  it("blocks on the precise identifier+address dimension", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: failures(LOGIN_RATE_LIMITS.pairMaxFailures, 2),
      identifierOnly: failures(5),
      ip: failures(5),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.scope).toBe("identifier_ip");
    // Window is 10 minutes and the oldest failure was 2 minutes ago.
    expect(decision.retryAfterSeconds).toBe(8 * 60);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("blocks a high-volume address even when no single identifier is hot", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: failures(1),
      identifierOnly: failures(1),
      ip: failures(LOGIN_RATE_LIMITS.ipMaxFailures, 1),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.scope).toBe("ip");
  });

  it("never returns a delay together with a block", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: failures(99),
      identifierOnly: failures(99),
      ip: failures(99),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.delayMs).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("evaluateLoginRateLimit — no trustworthy client address", () => {
  const base = { now, hasClientAddress: false };

  it("never hard-blocks, so an attacker cannot lock a real user out", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: empty,
      identifierOnly: failures(500),
      ip: empty,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.scope).toBe("identifier_delay");
  });

  it("applies no delay below the delay threshold", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: empty,
      identifierOnly: failures(LOGIN_RATE_LIMITS.identifierDelayAfter - 1),
      ip: empty,
    });
    expect(decision).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      scope: null,
      delayMs: 0,
    });
  });

  it("grows the delay with repeated failures and caps it", () => {
    const first = evaluateLoginRateLimit({
      ...base,
      identifierIp: empty,
      identifierOnly: failures(LOGIN_RATE_LIMITS.identifierDelayAfter),
      ip: empty,
    });
    const later = evaluateLoginRateLimit({
      ...base,
      identifierIp: empty,
      identifierOnly: failures(20),
      ip: empty,
    });
    expect(first.delayMs).toBe(400);
    expect(later.delayMs).toBe(LOGIN_RATE_LIMITS.maxDelayMs);
    expect(later.delayMs).toBeLessThanOrEqual(LOGIN_RATE_LIMITS.maxDelayMs);
  });

  it("ignores the address dimensions entirely when addresses are untrusted", () => {
    const decision = evaluateLoginRateLimit({
      ...base,
      identifierIp: failures(999),
      identifierOnly: failures(0),
      ip: failures(999),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.delayMs).toBe(0);
  });
});

describe("describeLoginRateLimitPolicy", () => {
  it("describes the policy without overclaiming", () => {
    const text = describeLoginRateLimitPolicy();
    expect(text).toContain("failed attempts");
    expect(text).toContain("delay");
    expect(text).not.toMatch(/immutable|tamper-proof/i);
  });
});
