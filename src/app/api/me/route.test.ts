import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Regression test for Phase 2 defect A — the `/api/me` response contract.
 *
 * The top bar (`UserTopBar`) reads `data.user`. The route previously returned
 * the identity fields at the TOP LEVEL of the body, so the signed-in user was
 * never rendered. These tests pin the contract that both sides now share
 * (`src/lib/me.ts`) and assert that nothing unnecessary is exposed.
 */

const getCurrentUserMock = vi.fn();

vi.mock("@/lib/authorization", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { GET } from "./route";

beforeEach(() => {
  getCurrentUserMock.mockReset();
});

describe("GET /api/me (identity contract)", () => {
  it("wraps the identity in `{ user: ... }` for an authenticated caller", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "usr_1",
      name: "Development Administrator",
      email: "admin@example.test",
      roles: ["SYSTEM_ADMIN"],
      permissions: new Set(["user.manage"]),
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("user");
    expect(body.user).toEqual({
      id: "usr_1",
      name: "Development Administrator",
      email: "admin@example.test",
      roles: ["SYSTEM_ADMIN"],
    });

    // The old broken shape must not come back.
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("roles");
  });

  it("does not expose permissions, sessions or secrets", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "usr_1",
      name: "Admin",
      email: "admin@example.test",
      roles: ["SYSTEM_ADMIN"],
      permissions: new Set(["user.manage", "role.manage"]),
    });

    const body = (await (await GET()).json()) as {
      user: Record<string, unknown>;
    };
    expect(body.user).not.toHaveProperty("permissions");
    expect(body.user).not.toHaveProperty("session");
    expect(body.user).not.toHaveProperty("token");
    expect(body.user).not.toHaveProperty("password");
  });

  it("returns 401 with no identity for an unauthenticated caller", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("user");
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 (not 500) when authorization throws UnauthorizedError", async () => {
    const { UnauthorizedError } = await import("@/lib/authorization");
    getCurrentUserMock.mockRejectedValue(new UnauthorizedError());

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns a generic 500 without leaking internals", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("db exploded at 10.0.0.5"));

    const response = await GET();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
