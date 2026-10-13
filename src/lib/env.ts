/**
 * Environment variable validation.
 *
 * We validate configuration with Zod so that a missing or malformed value
 * produces a clear, non-sensitive error (it names the variable, never its
 * value). Validation is LAZY: it runs when configuration is first needed,
 * not at module import time, so that builds and unit tests that never touch
 * the database do not fail merely because no .env is present.
 *
 * The local database is MariaDB (XAMPP) via Prisma's "mysql" provider, so the
 * DATABASE_URL must be a MySQL/MariaDB connection URL.
 */
import { z } from "zod";
import { parseEncryptionKey } from "@/lib/crypto/field-crypto";

export const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is not set.")
    // Accept MySQL/MariaDB URLs so we never silently run against another DB.
    .refine(
      (v) => /^mysql:\/\//i.test(v.trim()),
      {
        message:
          "DATABASE_URL must be a MySQL/MariaDB connection URL (starts with mysql://).",
      },
    ),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters."),
  // AES-256-GCM key for sensitive passenger identity fields. Optional so the
  // application still builds and runs for non-manifest work; passenger writes
  // FAIL CLOSED when it is absent (see src/lib/crypto/field-crypto.ts).
  FIELD_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) => !value || parseEncryptionKey(value) !== null,
      {
        message:
          "FIELD_ENCRYPTION_KEY must be a 32-byte key encoded as base64 or as 64 hex characters.",
      },
    ),
  // Optional retention configuration for manifest data (floor of 10 days).
  MANIFEST_RETENTION_DAYS: z.string().optional(),
  BETTER_AUTH_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Development-only admin bootstrap values (optional).
  SEED_ADMIN_EMAIL: z.string().min(1).optional(),
  SEED_ADMIN_PASSWORD: z.string().min(1).optional(),
  SEED_ADMIN_NAME: z.string().min(1).optional(),
  // Explicit opt-in required to bootstrap an admin in production.
  ALLOW_ADMIN_BOOTSTRAP: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Pure validation of a raw environment-like object. Exposed separately from
 * getServerEnv() so it can be unit-tested without touching module-level
 * caching. Throws a clear error listing the offending variable name(s) —
 * never the values — on failure.
 */
export function validateEnv(raw: unknown): ServerEnv {
  const parsed = serverEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => {
      const name = issue.path.join(".") || "(root)";
      // The message is one of OUR OWN static strings (e.g. "must be a
      // MySQL/MariaDB connection URL"). It never contains the offending
      // value, so including it is safe and makes the error actionable.
      return `${name}: ${issue.message}`;
    });
    // Names + static reasons only. Actual VALUES are never logged.
    throw new Error(
      `Invalid or missing environment configuration — ${details.join("; ")}. ` +
        `Check your .env file against .env.example.`,
    );
  }
  return parsed.data;
}

let cached: ServerEnv | null = null;

/**
 * Returns validated server environment configuration. Throws a clear error
 * listing the offending variable name(s) — never the values — on failure.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = validateEnv(process.env);
  return cached;
}

/** True when running in a production deployment. */
export function isProduction(): boolean {
  return getServerEnv().NODE_ENV === "production";
}
