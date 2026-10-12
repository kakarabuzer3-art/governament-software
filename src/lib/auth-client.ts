"use client";

/**
 * Browser-side Better Auth client. Used by the login form to call
 * sign-in/sign-out. It only ever talks to our own /api/auth routes; it holds
 * no privileges of its own — all authorization is enforced on the server.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
});
