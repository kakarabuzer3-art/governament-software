/**
 * Protected route handler requiring the USER_MANAGE permission.
 *
 * Demonstrates fine-grained server-side authorization: any authenticated user
 * whose roles do not grant USER_MANAGE receives 403 (never the protected
 * payload). This proves access is not granted merely by being logged in.
 */
import { NextResponse } from "next/server";
import {
  assertPermission,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import { recordAuditEvent } from "@/lib/audit";
import { headers } from "next/headers";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await assertPermission(PERMISSIONS.USER_MANAGE);

    const headerList = await headers();
    await recordAuditEvent({
      action: "admin.ping.access",
      outcome: "success",
      actorId: user.id,
      actorRole: user.roles[0] ?? null,
      ipAddress: headerList.get("x-forwarded-for"),
      userAgent: headerList.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      message: "You have user-management access.",
      actor: user.email,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
