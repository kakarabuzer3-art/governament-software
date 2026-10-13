/**
 * Shared response contract for the identity endpoint `GET /api/me`.
 *
 * WHY THIS FILE EXISTS (Phase 2 defect A):
 * The route handler previously returned the identity fields at the TOP LEVEL of
 * the JSON body, while `UserTopBar` read them from `data.user`. The two sides
 * silently disagreed, so the top bar always rendered "Not signed in" even for a
 * validly authenticated user. Keeping the contract in one shared, typed module
 * means the client and the route handler cannot drift apart again — a change
 * here breaks the TypeScript build on both sides instead of failing silently at
 * runtime.
 *
 * ONLY display-necessary identity is exposed. No session token, session id,
 * account record, password hash or full permission list is ever returned by the
 * endpoint.
 */

/** The minimal identity the shell needs to render the signed-in user. */
export interface MeIdentity {
  id: string;
  name: string;
  email: string;
  /** Role keys (e.g. "SYSTEM_ADMIN"). Display only — never used for authz. */
  roles: string[];
}

/** Success body of `GET /api/me` (HTTP 200). */
export interface MeResponse {
  user: MeIdentity;
}

/** Error body returned by `GET /api/me` (HTTP 401/500). */
export interface MeErrorResponse {
  error: string;
}

/**
 * Map the server-side `CurrentUser` down to the shareable identity contract.
 * Explicit field picking (never a spread) so new fields on `CurrentUser` can
 * not leak into the API response by accident.
 */
export function toMeIdentity(user: {
  id: string;
  name: string;
  email: string;
  roles: readonly string[];
}): MeIdentity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: [...user.roles],
  };
}

/** Build the success response body. */
export function toMeResponse(user: {
  id: string;
  name: string;
  email: string;
  roles: readonly string[];
}): MeResponse {
  return { user: toMeIdentity(user) };
}
