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
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";

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
    database: {
      generateId: false,
    },
  },

  plugins: [nextCookies()],
});

export type Auth = typeof auth;
