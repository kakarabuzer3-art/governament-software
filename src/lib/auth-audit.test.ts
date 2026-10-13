import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Regression test for Phase 2 defect B — authentication auditing.
 *
 * The documentation claimed login success/failure and logout were written to
 * `audit_event`; no auth event was ever persisted. These tests pin the actual
 * recording behaviour AND the privacy rules: no password, no token, no
 * submitted email, and no raw IP.
 */

type AuditInput = Record<string, unknown>;

const recordAuditEventMock = vi.fn<(input: AuditInput) => Promise<void>>(
  async () => undefined,
);

vi.mock("@/lib/audit", () => ({
  recordAuditEvent: (input: AuditInput) => recordAuditEventMock(input),
}));

import {
  AUTH_AUDIT_ACTIONS,
  auditLoginFailure,
  auditLoginSuccess,
  auditLogout,
  extractClientMeta,
  isFailedAuthResponse,
} from "./auth-audit";

beforeEach(() => {
  recordAuditEventMock.mockClear();
});

describe("extractClientMeta", () => {
  it("returns nulls without headers", () => {
    expect(extractClientMeta(null)).toEqual({
      ipAddress: null,
      userAgent: null,
    });
    expect(extractClientMeta(undefined)).toEqual({
      ipAddress: null,
      userAgent: null,
    });
  });

  it("takes only the first x-forwarded-for hop", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.7, 10.0.0.1",
      "user-agent": "Vitest",
    });
    expect(extractClientMeta(headers)).toEqual({
      ipAddress: "203.0.113.7",
      userAgent: "Vitest",
    });
  });

  it("truncates an oversized user agent", () => {
    const headers = new Headers({ "user-agent": "x".repeat(500) });
    expect(extractClientMeta(headers).userAgent?.length).toBe(255);
  });
});

describe("isFailedAuthResponse", () => {
  it("detects a failed APIError-style result", () => {
    expect(isFailedAuthResponse({ statusCode: 401 })).toBe(true);
    expect(isFailedAuthResponse({ status: 403 })).toBe(true);
  });

  it("treats a successful payload as success", () => {
    expect(isFailedAuthResponse({ token: "t", user: { id: "u1" } })).toBe(false);
    expect(isFailedAuthResponse(null)).toBe(false);
    expect(isFailedAuthResponse(undefined)).toBe(false);
    expect(isFailedAuthResponse("Unauthorized")).toBe(false);
  });
});

describe("auth audit recording", () => {
  it("records a failed sign-in with no actor and no attempted identifier", async () => {
    await auditLoginFailure({ ipAddress: "203.0.113.7", userAgent: "Vitest" });

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    const payload = recordAuditEventMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload.action).toBe(AUTH_AUDIT_ACTIONS.LOGIN_FAILURE);
    expect(payload.outcome).toBe("failure");
    expect(payload.actorId).toBeNull();
    expect(payload.targetId).toBeNull();
    // The raw IP is handed to recordAuditEvent under the `ipAddress` field,
    // which stores only a truncated hash (see audit.test.ts). No other field
    // carries client-identifying data.
    expect(payload.ipAddress).toBe("203.0.113.7");
    expect(Object.keys(payload).sort()).toEqual([
      "action",
      "actorId",
      "ipAddress",
      "outcome",
      "targetId",
      "userAgent",
    ]);
  });

  it("records a successful sign-in against the created session's user", async () => {
    await auditLoginSuccess({ userId: "usr_1" });

    const payload = recordAuditEventMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload.action).toBe(AUTH_AUDIT_ACTIONS.LOGIN_SUCCESS);
    expect(payload.outcome).toBe("success");
    expect(payload.actorId).toBe("usr_1");
  });

  it("records a logout", async () => {
    await auditLogout({ userId: "usr_1" });

    const payload = recordAuditEventMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload.action).toBe(AUTH_AUDIT_ACTIONS.LOGOUT);
    expect(payload.outcome).toBe("success");
    expect(payload.actorId).toBe("usr_1");
  });

  it("never records secret-bearing keys", async () => {
    await auditLoginSuccess({ userId: "usr_1" });
    await auditLoginFailure({ ipAddress: null, userAgent: null });

    for (const call of recordAuditEventMock.mock.calls) {
      const payload = call[0] as Record<string, unknown>;
      expect(Object.keys(payload)).not.toContain("password");
      expect(Object.keys(payload)).not.toContain("token");
      expect(Object.keys(payload)).not.toContain("email");
      expect(Object.keys(payload)).not.toContain("accessToken");
      expect(Object.keys(payload)).not.toContain("refreshToken");
    }
  });

  it("skips recording when there is no user id", async () => {
    await auditLoginSuccess({ userId: "" });
    await auditLogout({ userId: "" });
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });
});
