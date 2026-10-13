/**
 * Password policy and generation, shared by the seed script and the user
 * administration interface.
 *
 * Dependency-free on purpose: it is imported both by application code (via the
 * `@/` alias) and by `prisma/seed.ts`, which runs through `tsx` with relative
 * imports and no path aliases.
 */

/** Minimum length. The authentication library enforces the same floor. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Values that must never be usable as a real credential. This list only needs
 * to catch values that look like committed defaults; the length rule is the
 * real control.
 */
export const FORBIDDEN_PLACEHOLDER_PASSWORDS: readonly string[] = [
  "change-me-in-development",
  "changeme",
  "change-me",
  "password",
  "password123",
  "admin",
  "admin123",
  "administrator",
  "replace-with-a-strong-password",
  "your-password",
  "letmein",
  "welcome123",
];

/**
 * Returns a human-readable reason when a password is unacceptable, or null
 * when it is acceptable. The password itself is NEVER included in the message.
 */
export function passwordPolicyError(password: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "A password is required.";
  }
  // Checked BEFORE the length rule so a short well-known value gets the more
  // useful message ("that is a known placeholder") rather than "too short".
  if (FORBIDDEN_PLACEHOLDER_PASSWORDS.includes(password.toLowerCase())) {
    return "That password is a well-known placeholder. Choose a unique one.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `The password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `The password must be at most ${MAX_PASSWORD_LENGTH} characters long.`;
  }
  return null;
}

/** Convenience predicate used by the seed script. */
export function isAcceptablePassword(password: string): boolean {
  return passwordPolicyError(password) === null;
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // no l
const DIGITS = "23456789"; // no 0/1
const SYMBOLS = "!@#%^*-_=+";

/**
 * Generate a strong initial password using a cryptographic source.
 *
 * Guarantees at least one character from each class, then fills and shuffles,
 * so the result always satisfies both the library and this policy.
 */
export function generateInitialPassword(length = 20): string {
  const size = Math.max(length, MIN_PASSWORD_LENGTH);
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const required = [UPPER, LOWER, DIGITS, SYMBOLS].map(
    (set) => set[randomIndex(set.length)],
  );

  const chars: string[] = [...required];
  while (chars.length < size) chars.push(all[randomIndex(all.length)]);

  // Fisher-Yates shuffle using the cryptographic source.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Human-readable policy summary for the UI. */
export function describePasswordPolicy(): string {
  return (
    `At least ${MIN_PASSWORD_LENGTH} characters, up to ${MAX_PASSWORD_LENGTH}. ` +
    "Placeholder and well-known values are refused."
  );
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

// Imported lazily at module scope; node:crypto is always available server-side.
import { randomBytes } from "node:crypto";

/** Uniformly-distributed random integer in [0, max) without modulo bias. */
function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  for (;;) {
    const byte = randomBytes(1)[0];
    if (byte < limit) return byte % max;
  }
}
