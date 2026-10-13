/**
 * Authorization error types.
 *
 * Deliberately kept in their own dependency-free module so that code which only
 * needs to *classify* an authorization failure (form-state mapping, tests,
 * standalone verification scripts) does not have to import the session layer
 * (`next/headers`, Better Auth, Prisma singleton).
 *
 * `src/lib/authorization.ts` re-exports these, so existing imports keep working.
 */

/** Thrown when an authenticated user lacks a required permission (403). */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when there is no valid authenticated session (401). */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
