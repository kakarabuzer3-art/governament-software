/**
 * Protected route handler: returns the current authenticated user's basic
 * identity and permissions, or 401 when there is no valid session.
 *
 * Exists primarily to demonstrate and test that server-side authorization
 * actually blocks unauthenticated and unauthorized requests — not merely the
 * UI. Permissions are resolved from the database via the verified session.
 */
import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/authorization";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: Array.from(user.permissions),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
