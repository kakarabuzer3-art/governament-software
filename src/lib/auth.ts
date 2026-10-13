/**
 * Server-side Better Auth instance (Prisma + MySQL/MariaDB).
 *
 * Why Better Auth: it is officially recommended for the Next.js App Router,
 * has a maintained Prisma adapter, handles password hashing and secure
 * session cookies for us, and avoids hand-rolling authentication crypto.
 *
 * Security choices:
 *  - Public self-service sign-up is DISABLED. Accounts are provisioned only
 *    through the controlled admin bootstrap / seed process. This is a
 *    controlled-access system, not an open public service.
 *  - Database-backed sessions (not stateless JWT cookies) so a session can be
 *    revoked server-side on logout.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";
import {
  auditLoginFailure,
  auditLoginSuccess,
  auditLogout,
  extractClientMeta,
  isFailedAuthResponse,
} from "@/lib/auth-audit";

const env = getServerEnv();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,

  emailAndPassword: {
    enabled: true,
    // Disable public registration. Accounts are created only by administrators.
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

  session: {
    // Server-side session records (database sessions).
    expiresIn: 60 * 60 * 8, // 8 hours
    updateAge: 60 * 60, // refresh the session token once per hour of use
    cookieCache: {
      enabled: false,
    },
  },

  advanced: {
    // Rely on secure cookies; explicit production hardening is applied in
    // middleware/route configuration (SameSite, Secure over HTTPS).
    useSecureCookies: env.NODE_ENV === "production",
    // -----------------------------------------------------------------------
    // DEFECT G (found by live end-to-end verification, not by reading code):
    // Phase 2 shipped `database: { generateId: false }`, which tells Better
    // Auth "the database supplies the primary key". Our Prisma models declare
    // `id String @id` with NO @default(), so Prisma requires an explicit value
    // and every sign-in failed with `Argument 'id' is missing`. Login had never
    // actually worked, despite the Phase 2 report claiming a verified flow.
    //
    // The override is removed so Better Auth generates the id itself (its
    // default behaviour). No schema change is required.
    // -----------------------------------------------------------------------
  },

  // -------------------------------------------------------------------------
  // Audit recording (Phase 2 defect B).
  //
  // These hooks are the ONLY place auth events are persisted. They write
  // through `recordAuditEvent`, which never throws: a failing audit write logs
  // server-side and leaves the sign-in/sign-out flow untouched.
  // -------------------------------------------------------------------------
  databaseHooks: {
    session: {
      create: {
        after: async (session, context) => {
          // A session row is created exactly when a sign-in succeeds.
          const meta = extractClientMeta(context?.headers);
          await auditLoginSuccess({
            userId: typeof session.userId === "string" ? session.userId : "",
            ipAddress:
              (session.ipAddress as string | null | undefined) ?? meta.ipAddress,
            userAgent:
              (session.userAgent as string | null | undefined) ?? meta.userAgent,
          });
        },
      },
      delete: {
        after: async (session) => {
          // Sign-out (and admin revocation) delete the session row.
          await auditLogout({
            userId: typeof session.userId === "string" ? session.userId : "",
            ipAddress: (session.ipAddress as string | null | undefined) ?? null,
            userAgent: (session.userAgent as string | null | undefined) ?? null,
          });
        },
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Failed sign-ins never create a session row, so they need this hook.
      // Better Auth runs `after` hooks even when the endpoint threw, with the
      // thrown APIError available on `context.returned`.
      if (ctx.path !== "/sign-in/email") return;
      if (!isFailedAuthResponse(ctx.context.returned)) return;
      const headers =
        (ctx as { request?: Request }).request?.headers ??
        (ctx as { headers?: Headers }).headers ??
        null;
      await auditLoginFailure(extractClientMeta(headers));
    }),
  },

  plugins: [nextCookies()],
});

export type Auth = typeof auth;
