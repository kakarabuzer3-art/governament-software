/**
 * Live database verification (non-destructive).
 *
 * Usage:  npm run db:verify
 *
 * Connects to the configured MariaDB development database and prints:
 *  - the tables that actually exist,
 *  - row counts for the auth / RBAC / audit tables,
 *  - the most recent audit events,
 *  - the Phase 3 transport tables when they are present.
 *
 * It performs READ-ONLY queries. It never prints `.env` contents, passwords,
 * password hashes or session tokens. Run it to prove that a claim about the
 * live database is real rather than inferred from a migration file.
 */
import "../prisma/load-env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function shortId(value: string | null): string {
  if (!value) return "-";
  return value.length > 10 ? `${value.slice(0, 10)}…` : value;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !/^mysql:\/\//i.test(url)) {
    throw new Error(
      "DATABASE_URL is missing or is not a mysql:// URL. Fill in .env first.",
    );
  }
  // Redacted connection target: host/db only, never credentials.
  const parsed = new URL(url);
  console.log(
    `[verify] Target: MySQL/MariaDB database "${parsed.pathname.replace(/^\//, "")}" ` +
      `at ${parsed.hostname}:${parsed.port || "3306"}`,
  );

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT TABLE_NAME AS tableName FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME
  `;
  const tableNames = rows
    .map((row) => String(row.tableName ?? Object.values(row)[0] ?? ""))
    .filter(Boolean);
  console.log(`[verify] Tables (${tableNames.length}): ${tableNames.join(", ")}`);

  const [userCount, sessionCount, roleCount, permissionCount, auditCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.auditEvent.count(),
    ]);
  console.log(
    `[verify] auth/RBAC rows: user=${userCount} session=${sessionCount} ` +
      `role=${roleCount} permission=${permissionCount} audit_event=${auditCount}`,
  );

  const recent = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { action: true, outcome: true, actorId: true, createdAt: true },
  });
  if (recent.length === 0) {
    console.log("[verify] audit_event is empty (no events recorded yet).");
  } else {
    console.log("[verify] most recent audit_event rows:");
    for (const event of recent) {
      console.log(
        `  - ${event.createdAt.toISOString()}  ${event.action}  ` +
          `outcome=${event.outcome}  actor=${shortId(event.actorId)}`,
      );
    }
  }

  // Phase 3–5 tables: report only when they exist.
  const transportTables = [
    "operator",
    "vehicle",
    "route",
    "permit",
    "user_operator",
    "trip",
    "passenger",
    "inspection",
    "incident",
  ];
  for (const table of transportTables) {
    if (!tableNames.includes(table)) {
      console.log(`[verify] ${table}: NOT PRESENT`);
      continue;
    }
    const count = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      `SELECT COUNT(*) AS n FROM \`${table}\``,
    );
    console.log(`[verify] ${table}: ${Number(count[0]?.n ?? 0)} row(s)`);
  }
}

main()
  .catch((error) => {
    console.error(
      "[verify] Failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
