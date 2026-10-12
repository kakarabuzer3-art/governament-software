import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Authorization semantics with a MOCKED database/session layer.
 *
 * These tests prove the security-critical behaviour that does NOT require a
 * live PostgreSQL connection:
 *  - unauthenticated access is denied (assertPermission throws 401)
 *  - a user lacking a permission is denied (assertPermission throws 403)
 *  - a user with the permission is allowed
 *  - default-deny: an unknown/empty permission set always denies
 *  - permissions come from the DATABASE role assignments, not from the client
 *
 * A full end-to-end login/logout/session-invalidation test requires a running
 * PostgreSQL database and is documented as a manual/integration step.
 */

// --- Mock the collaborators before importing the module under test ----------
const getSessionMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
  },
}));

const findUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// next/navigation redirect() throws a special error in the real router; emulate.
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

import {
  assertPermission,
  getCurrentUser,
  ForbiddenError,
  UnauthorizedError,
} from "./authorization";
import { PERMISSIONS } from "./rbac";

beforeEach(() => {
  getSessionMock.mockReset();
  findUniqueMock.mockReset();
});

describe("getCurrentUser (DB-backed identity)", () => {
  it("returns null when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
    // Should not even query the DB without a session.
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null when the session references a missing user", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("derives roles and permissions from DB role assignments only", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "admin@example.test",
      name: "Admin",
      roleAssignments: [
        {
          role: {
            key: "SYSTEM_ADMIN",
            permissions: [{ permission: { key: "user.manage" } }],
          },
        },
      ],
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.roles).toEqual(["SYSTEM_ADMIN"]);
    expect(user?.permissions.has(PERMISSIONS.USER_MANAGE)).toBe(true);
    // Default-deny: a permission not granted is absent.
    expect(user?.permissions.has(PERMISSIONS.ROLE_MANAGE)).toBe(false);
  });
});

describe("assertPermission (server actions / route handlers)", () => {
  it("throws 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(
      assertPermission(PERMISSIONS.USER_MANAGE),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws 403 when authenticated but lacking the permission", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "op@example.test",
      name: "Operator",
      roleAssignments: [
        {
          role: {
            key: "OPERATOR_STAFF",
            permissions: [{ permission: { key: "trip.view" } }],
          },
        },
      ],
    });

    await expect(
      assertPermission(PERMISSIONS.USER_MANAGE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("resolves the user when the permission is granted", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "admin@example.test",
      name: "Admin",
      roleAssignments: [
        {
          role: {
            key: "SYSTEM_ADMIN",
            permissions: [{ permission: { key: "user.manage" } }],
          },
        },
      ],
    });

    const user = await assertPermission(PERMISSIONS.USER_MANAGE);
    expect(user.id).toBe("u1");
  });

  it("denies a user with no role assignments at all (default-deny)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({
      id: "u1",
      email: "nobody@example.test",
      name: "No Roles",
      roleAssignments: [],
    });
    await expect(
      assertPermission(PERMISSIONS.DASHBOARD_VIEW),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
