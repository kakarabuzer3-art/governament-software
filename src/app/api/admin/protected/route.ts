import { NextResponse } from "next/server";
import { assertPermission, ForbiddenError, UnauthorizedError } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";

/**
 * A protected API route used to demonstrate (and be tested against) that
 * server-side authorization is enforced on route handlers — not just on
 * pages. It requires the USER_MANAGE permission.
 *
 * This proves that hiding UI is not our security boundary: even a direct
 * HTTP request to this endpoint is denied unless the caller's server-verified
 * session carries the required permission.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await assertPermission(PERMISSIONS.USER_MANAGE);
    return NextResponse.json({
      ok: true,
      message: "Authorized access to protected resource.",
      user: { id: user.id, email: user.email, roles: user.roles },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    // Never leak internal error details to the client.
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
