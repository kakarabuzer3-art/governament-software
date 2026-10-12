/**
 * Reusable server-side Prisma client.
 *
 * Follows the official singleton pattern so Next.js hot-reload in development
 * does not open a new database connection on every reload (which would
 * exhaust PostgreSQL connection limits). The client is only instantiated on
 * first use, never on the browser, because it is imported solely by server
 * code and the seed script.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
