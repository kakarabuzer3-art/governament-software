/**
 * `.env` loader for standalone scripts (Phase 2 defect E).
 *
 * Next.js loads `.env` automatically for the application, but a script run
 * through `tsx` does NOT — so `npm run db:seed` previously ran with no
 * `DATABASE_URL` and no `SEED_ADMIN_*` values at all. The Phase 2 report
 * nonetheless claimed a seeded administrator; that claim was not reproducible
 * from the documented command.
 *
 * This module is imported as the FIRST import of `prisma/seed.ts` so the
 * environment is populated before `new PrismaClient()` reads it. It never
 * prints the file contents or any value.
 *
 * Uses Node's built-in `process.loadEnvFile` (Node >= 20.12), so no extra
 * dependency is required. Real process environment variables always win: the
 * file is only loaded when present.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
