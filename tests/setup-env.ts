/**
 * Vitest setup: load the local, git-ignored `.env` before tests run.
 *
 * Integration tests need `DATABASE_URL`. Unit tests do not care, and they mock
 * Prisma, so loading the file is harmless for them. No value is ever printed.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
