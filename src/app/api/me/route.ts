/**
 * GET /api/me — the authenticated user's minimal identity.
 *
 * Phase 2 defect A: this handler used to return the identity at the TOP LEVEL
 * (`{ id, name, email, roles, permissions }`) while `UserTopBar` expected
 * `{ user: ... }`, so the shell never showed the signed-in user. It now returns
 * the documented shared contract from `src/lib/me.ts`.
 *
 * It also no longer returns the caller's full permission list: the shell only
 * needs a display identity, and authorisation decisions are always re-made
 * server-side per request. Least information exposure.
 *
 * Unauthenticated callers receive 401 with no identity payload at all.
 */
import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/authorization";
import { toMeResponse, type MeErrorResponse, type MeResponse } from "@/lib/me";

export async function GET(): Promise<
  NextResponse<MeResponse | MeErrorResponse>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(toMeResponse(user), { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Never leak internal error details to the client.
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
