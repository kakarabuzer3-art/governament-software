/**
 * Same-origin redirect validation for the `?next=` login parameter.
 *
 * WHY THIS FILE EXISTS (Phase 2 defect D):
 * The previous inline check only rejected values that did not start with "/"
 * and values starting with "//". Browsers normalise a BACKSLASH to a forward
 * slash for special URL schemes, so an attacker-supplied `next=/\evil.example`
 * still resolved to `http://evil.example/` — an open redirect that can be used
 * for credential-phishing after a genuine sign-in.
 *
 * Strategy: treat the input as hostile and require it to survive a real URL
 * parse against a fixed internal origin with the SAME origin. Anything that
 * resolves off-origin, or that cannot be parsed, falls back to "/". Only a
 * path/search/hash is ever returned — never the resolved absolute URL.
 */

/** Safe fallback target when the requested destination is not acceptable. */
export const DEFAULT_REDIRECT_TARGET = "/";

/**
 * A sentinel origin used only for parsing. `.invalid` is reserved by RFC 2606
 * and can never be a real host, so no external value can legitimately match it.
 */
const PARSE_BASE = "http://internal.invalid";

/**
 * Returns a safe, same-origin, relative target for a post-login redirect.
 *
 * Accepted:   "/", "/operators", "/operators?page=2#top"
 * Rejected:   "//evil.test", "/\evil.test", "https://evil.test",
 *             "javascript:alert(1)", "", null, control characters.
 */
export function safeNextTarget(
  raw: string | null | undefined,
): string {
  if (typeof raw !== "string") return DEFAULT_REDIRECT_TARGET;

  const value = raw.trim();
  if (!value) return DEFAULT_REDIRECT_TARGET;

  // Control characters (including tab/newline) are ignored or re-interpreted
  // by browsers during URL parsing — refuse them outright. C1 controls too.
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    return DEFAULT_REDIRECT_TARGET;
  }

  // Must be a site-absolute PATH, not a scheme or a bare relative segment.
  if (!value.startsWith("/")) return DEFAULT_REDIRECT_TARGET;

  // Backslashes are normalised to "/" by browsers, turning "/\evil.test" into
  // the protocol-relative "//evil.test". Refuse backslashes entirely.
  if (value.includes("\\")) return DEFAULT_REDIRECT_TARGET;

  // Explicit protocol-relative form.
  if (value.startsWith("//")) return DEFAULT_REDIRECT_TARGET;

  try {
    const url = new URL(value, PARSE_BASE);
    // Authoritative check: the parsed origin must still be our sentinel.
    if (url.origin !== PARSE_BASE) return DEFAULT_REDIRECT_TARGET;
    if (!url.pathname.startsWith("/")) return DEFAULT_REDIRECT_TARGET;
    // Rebuild from components only — never return the resolved absolute URL.
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT_TARGET;
  }
}
