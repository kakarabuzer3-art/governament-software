/**
 * Better Auth catch-all route handler.
 *
 * Mounts the entire Better Auth API (sign-in, sign-out, session) under
 * /api/auth/*. All real authentication logic lives in the library; this file
 * only wires it into the Next.js App Router.
 */
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
