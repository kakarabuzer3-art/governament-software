/**
 * Better Auth catch-all route handler, wrapped with an explicit sign-in gate.
 *
 * WHY A WRAPPER IS NEEDED (Phase 2/3 review, GAP-04 + account disabling)
 *  1. Better Auth does not rate limit by default, and it has no knowledge of
 *     our account-disabled marker. Without this wrapper a disabled account with
 *     a valid password could still obtain a session.
 *  2. The gate runs BEFORE Better Auth, so a blocked or disabled attempt never
 *     reaches credential verification and never creates a session.
 *
 * The wrapper only inspects `/api/auth/sign-in/email`. Every other auth request
 * (get-session, sign-out, ...) is passed straight through.
 *
 * All other authentication logic (password hashing, session creation, cookies,
 * CSRF/origin checks) remains Better Auth's responsibility.
 */
import { NextResponse, type NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { extractClientMeta } from "@/lib/auth-audit";
import {
  clearLoginFailures,
  evaluateLoginRateLimit,
  loadLoginWindows,
  loginClientHash,
  loginIdentifierHash,
  recordLoginAttempt,
  type LoginRateLimitDecision,
} from "@/lib/auth-rate-limit";

const handlers = toNextJsHandler(auth);

const SIGN_IN_PATH = "/api/auth/sign-in/email";

/**
 * The exact body Better Auth returns for an invalid credential. Used for the
 * disabled-account rejection too, so the response is not an account-enumeration
 * oracle.
 */
const GENERIC_REJECTION = {
  message: "Invalid email or password",
  code: "INVALID_EMAIL_OR_PASSWORD",
};

const NO_STORE = { "cache-control": "no-store" } as const;

const FAIL_OPEN: LoginRateLimitDecision = {
  allowed: true,
  retryAfterSeconds: 0,
  scope: null,
  delayMs: 0,
};

function pathnameOf(request: NextRequest): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

/** Read the submitted email without consuming the request the handler needs. */
async function readEmail(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body?.email === "string" ? body.email : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest): Promise<Response> {
  if (pathnameOf(request) !== SIGN_IN_PATH) {
    return handlers.POST(request);
  }

  const email = await readEmail(request);
  const meta = extractClientMeta(request.headers);
  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  const identifierHash = normalizedEmail
    ? loginIdentifierHash(normalizedEmail)
    : undefined;
  const clientHash = loginClientHash(meta.ipAddress);
  const hasClientAddress = Boolean(meta.ipAddress);
  const now = new Date();

  // --- 1. Rate limit ------------------------------------------------------
  let decision = FAIL_OPEN;
  try {
    const windows = await loadLoginWindows({ identifierHash, clientHash, now });
    decision = evaluateLoginRateLimit({
      ...windows,
      hasClientAddress,
      now,
    });
  } catch (error) {
    // The throttle ledger being unavailable must not take sign-in down; the
    // degradation is logged so it is visible. Documented trade-off.
    console.error("[auth-gate] rate-limit check unavailable", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }

  if (!decision.allowed) {
    await recordLoginAttempt({ identifierHash, clientHash, outcome: "blocked" });
    await recordAuditEvent({
      action: "auth.login.throttled",
      outcome: "failure",
      actorId: null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json(
      {
        message: "Too many sign-in attempts. Please try again shortly.",
        code: "TOO_MANY_REQUESTS",
      },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "retry-after": String(decision.retryAfterSeconds),
        },
      },
    );
  }

  if (decision.delayMs > 0) {
    await sleep(decision.delayMs);
  }

  // --- 2. Disabled accounts ----------------------------------------------
  if (normalizedEmail) {
    const account = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, disabledAt: true },
    });
    if (account?.disabledAt) {
      await recordLoginAttempt({ identifierHash, clientHash, outcome: "failure" });
      await recordAuditEvent({
        action: "auth.login.failure",
        outcome: "failure",
        actorId: account.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return NextResponse.json(GENERIC_REJECTION, {
        status: 401,
        headers: NO_STORE,
      });
    }
  }

  // --- 3. Delegate to Better Auth ----------------------------------------
  const response = await handlers.POST(request);

  if (response.ok) {
    await clearLoginFailures({ identifierHash, clientHash });
    await recordLoginAttempt({ identifierHash, clientHash, outcome: "success" });
  } else {
    await recordLoginAttempt({ identifierHash, clientHash, outcome: "failure" });
  }

  return response;
}

export const GET = handlers.GET;
