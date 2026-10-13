/**
 * Dashboard aggregates — database-backed (Phase 6).
 *
 * Every figure here is a live COUNT from MariaDB, filtered by the caller's
 * operator scope. Nothing is hardcoded, and where a module does not exist yet
 * the card is simply omitted rather than filled with an invented number.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operatorFilter, operatorIdFilter, type OperatorScope } from "./scope";

export interface DashboardSummary {
  operators: number;
  vehicles: number;
  activePermits: number;
  permitsPending: number;
  permitsExpiringSoon: number;
  tripsRecorded: number;
  upcomingTrips: number;
  manifestEntries: number;
  openIncidents: number;
  inspectionsNeedingAttention: number;
}

export interface DashboardTripRow {
  id: string;
  tripRef: string;
  departureAt: Date;
  status: string;
  operatorName: string;
  routeLabel: string | null;
  manifestEntries: number;
}

const ACTIVE_OPERATOR: Prisma.OperatorWhereInput = { status: { not: "ARCHIVED" } };
const ACTIVE_VEHICLE: Prisma.VehicleWhereInput = { status: { not: "ARCHIVED" } };
const ACTIVE_TRIP: Prisma.TripWhereInput = { status: { not: "ARCHIVED" } };

/** Load the summary counters. All reads are scope-filtered on the server. */
export async function getDashboardSummary(
  scope: OperatorScope,
): Promise<DashboardSummary> {
  const operatorScope = { ...operatorFilter(scope) };
  const operatorScopeAsOperator = {
    ...operatorIdFilter(scope),
  } as Prisma.OperatorWhereInput;
  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    operators,
    vehicles,
    activePermits,
    permitsPending,
    permitsExpiringSoon,
    tripsRecorded,
    upcomingTrips,
    manifestEntries,
    openIncidents,
    inspectionsNeedingAttention,
  ] = await Promise.all([
    prisma.operator.count({
      where: { AND: [operatorScopeAsOperator, ACTIVE_OPERATOR] },
    }),
    prisma.vehicle.count({ where: { AND: [operatorScope, ACTIVE_VEHICLE] } }),
    prisma.permit.count({
      where: { AND: [operatorScope, { status: "ACTIVE" }] },
    }),
    prisma.permit.count({
      where: { AND: [operatorScope, { status: "PENDING" }] },
    }),
    prisma.permit.count({
      where: {
        AND: [
          operatorScope,
          { status: "ACTIVE", expiresOn: { not: null, lte: inThirtyDays } },
        ],
      },
    }),
    prisma.trip.count({ where: { AND: [operatorScope, ACTIVE_TRIP] } }),
    prisma.trip.count({
      where: {
        AND: [operatorScope, ACTIVE_TRIP, { departureAt: { gte: now } }],
      },
    }),
    // Passenger counts are only ever aggregated, never listed, here.
    prisma.passenger.count({
      where: { removedAt: null, trip: { ...operatorFilter(scope) } },
    }),
    prisma.incident.count({
      where: { AND: [operatorScope, { status: { in: ["REPORTED", "UNDER_REVIEW"] } }] },
    }),
    prisma.inspection.count({
      where: {
        AND: [operatorScope, { result: { in: ["FAIL", "PASS_WITH_FINDINGS"] } }],
      },
    }),
  ]);

  return {
    operators,
    vehicles,
    activePermits,
    permitsPending,
    permitsExpiringSoon,
    tripsRecorded,
    upcomingTrips,
    manifestEntries,
    openIncidents,
    inspectionsNeedingAttention,
  };
}

/** The most recent journeys, for the dashboard table. */
export async function getRecentTrips(
  scope: OperatorScope,
  take = 8,
): Promise<DashboardTripRow[]> {
  const rows = await prisma.trip.findMany({
    where: {
      AND: [{ ...operatorFilter(scope) }, ACTIVE_TRIP],
    },
    select: {
      id: true,
      tripRef: true,
      departureAt: true,
      status: true,
      operator: { select: { name: true } },
      route: { select: { code: true, name: true } },
      _count: { select: { passengers: true } },
    },
    orderBy: { departureAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    tripRef: row.tripRef,
    departureAt: row.departureAt,
    status: row.status,
    operatorName: row.operator.name,
    routeLabel: row.route ? `${row.route.code} — ${row.route.name}` : null,
    manifestEntries: row._count.passengers,
  }));
}
