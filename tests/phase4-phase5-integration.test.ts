import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ConflictError, ValidationError } from "@/lib/transport/errors";
import type { TransportContext } from "@/lib/transport/context";
import type { PermissionKey } from "@/lib/rbac";
import { resolveOperatorScope } from "@/lib/transport/scope";
import * as operators from "@/lib/transport/operators";
import * as vehicles from "@/lib/transport/vehicles";
import * as trips from "@/lib/transport/trips";
import * as passengers from "@/lib/transport/passengers";
import * as inspections from "@/lib/transport/inspections";
import * as incidents from "@/lib/transport/incidents";
import { requireFieldEncryptionKey } from "@/lib/crypto/field-crypto";

/**
 * LIVE DATABASE integration test for Phases 4 and 5 (MariaDB via XAMPP).
 *
 * Proves, against the real database, that:
 *  - passenger identity data is stored ONLY as AES-256-GCM ciphertext;
 *  - masked values never reveal the full identity;
 *  - a reveal is audited and the audit event contains no passenger values;
 *  - duplicate identities on the same trip are rejected;
 *  - operator isolation and cross-operator denial hold;
 *  - inspection/incident rules are enforced.
 *
 * All rows created here are namespaced with a per-run prefix and removed in
 * afterAll. Nothing is truncated or reset.
 */

const RUN = `ZZ45${Date.now().toString(36).toUpperCase()}`;
const hasDatabase = Boolean(process.env.DATABASE_URL);
const CNIC = "17301-1234567-1";
const CNIC_DIGITS = "1730112345671";

let actorId = "";
const operatorIds: string[] = [];
const vehicleIds: string[] = [];
const tripIds: string[] = [];
const passengerIds: string[] = [];
const inspectionIds: string[] = [];
const incidentIds: string[] = [];

function ctxFor(roles: string[], scopedOperatorIds: string[] = []): TransportContext {
  return {
    user: {
      id: actorId,
      email: `${RUN.toLowerCase()}@example.test`,
      name: "Synthetic Test Actor",
      roles,
      permissions: new Set<PermissionKey>(),
      operatorIds: scopedOperatorIds,
    },
    scope: resolveOperatorScope({ roles, operatorIds: scopedOperatorIds }),
  };
}

const admin = () => ctxFor(["SYSTEM_ADMIN"]);
const staff = (ids: string[]) => ctxFor(["OPERATOR_STAFF"], ids);

const describeDb = hasDatabase ? describe : describe.skip;

describeDb("Phase 4/5 against live MariaDB", () => {
  beforeAll(async () => {
    requireFieldEncryptionKey(); // fail fast if the key is not configured
    const user = await prisma.user.create({
      data: {
        id: `usr_${randomUUID()}`,
        name: "Synthetic Test Actor",
        email: `${RUN.toLowerCase()}@example.test`,
      },
      select: { id: true },
    });
    actorId = user.id;

    const operator = await operators.createOperator(admin(), {
      code: `${RUN}-OP`,
      name: "Synthetic Operator",
    });
    operatorIds.push(operator.id);

    const vehicle = await vehicles.createVehicle(admin(), {
      registrationNumber: `${RUN}-V`,
      operatorId: operator.id,
    });
    vehicleIds.push(vehicle.id);

    const trip = await trips.createTrip(admin(), {
      tripRef: `${RUN}-T1`,
      operatorId: operator.id,
      vehicleId: vehicle.id,
      departureAt: "2026-06-01T08:00",
      status: "SCHEDULED",
    });
    tripIds.push(trip.id);
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    if (passengerIds.length) {
      await prisma.passenger.deleteMany({ where: { id: { in: passengerIds } } });
    }
    if (incidentIds.length) {
      await prisma.incident.deleteMany({ where: { id: { in: incidentIds } } });
    }
    if (inspectionIds.length) {
      await prisma.inspection.deleteMany({ where: { id: { in: inspectionIds } } });
    }
    if (tripIds.length) {
      await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
    }
    if (vehicleIds.length) {
      await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    }
    if (operatorIds.length) {
      await prisma.operator.deleteMany({ where: { id: { in: operatorIds } } });
    }
    if (actorId) {
      await prisma.user.delete({ where: { id: actorId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // Phase 4 — encrypted manifests
  // -------------------------------------------------------------------------

  it("stores passenger identity data as ciphertext, never plaintext", async () => {
    const created = await passengers.createPassenger(admin(), tripIds[0], {
      passengerName: "Synthetic Passenger",
      fatherName: "Synthetic Father",
      identityType: "CNIC",
      identityNumber: CNIC,
      mobileNumber: "03001234567",
      permanentAddress: "House 1, Sample Street, Quetta",
    });
    passengerIds.push(created.id);

    const row = await prisma.passenger.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        identityNumberEncrypted: true,
        mobileEncrypted: true,
        permanentAddressEncrypted: true,
        identityFingerprint: true,
        identityMasked: true,
        mobileMasked: true,
      },
    });

    // Encrypted columns must be AES-GCM payloads and contain no plaintext.
    for (const value of [
      row.identityNumberEncrypted,
      row.mobileEncrypted,
      row.permanentAddressEncrypted,
    ]) {
      expect(value.startsWith("v1:")).toBe(true);
      expect(value).not.toContain(CNIC_DIGITS);
      expect(value).not.toContain("03001234567");
      expect(value).not.toContain("Sample Street");
    }

    // The fingerprint must not be the raw value nor a trivially reversible form.
    expect(row.identityFingerprint).not.toContain(CNIC_DIGITS);
    expect(row.identityFingerprint).toHaveLength(32);

    // Masked display values must hide the middle digits.
    expect(row.identityMasked).not.toContain(CNIC_DIGITS);
    expect(row.identityMasked).toMatch(/\u2022/);
    expect(row.mobileMasked).not.toContain("03001234567");
    expect(row.mobileMasked).toMatch(/\u2022/);
  });

  it("never returns encrypted columns through the list projection", async () => {
    const rows = await passengers.listPassengers(admin(), tripIds[0]);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain("identityNumberEncrypted");
      expect(Object.keys(row)).not.toContain("mobileEncrypted");
      expect(Object.keys(row)).not.toContain("permanentAddressEncrypted");
    }
  });

  it("rejects a duplicate identity on the same journey", async () => {
    await expect(
      passengers.createPassenger(admin(), tripIds[0], {
        passengerName: "Duplicate Passenger",
        fatherName: "Father",
        identityType: "CNIC",
        identityNumber: CNIC_DIGITS, // same person, different punctuation
        mobileNumber: "03001234567",
        permanentAddress: "Somewhere",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("reveals full details only through the audited path, without logging them", async () => {
    const revealed = await passengers.revealPassenger(admin(), passengerIds[0]);
    expect(revealed.identityNumber).toBe(CNIC);
    expect(revealed.mobileNumber).toBe("03001234567");
    expect(revealed.permanentAddress).toContain("Sample Street");

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "passenger.revealed", targetId: passengerIds[0] },
    });
    expect(audit).not.toBeNull();

    // The audit row must not contain any passenger value.
    const serialised = JSON.stringify(audit);
    expect(serialised).not.toContain(CNIC_DIGITS);
    expect(serialised).not.toContain("03001234567");
    expect(serialised).not.toContain("Sample Street");
  });

  it("withdraws and restores a manifest entry without deleting it", async () => {
    await passengers.setPassengerRemoved(admin(), passengerIds[0], true);
    const hidden = await passengers.listPassengers(admin(), tripIds[0]);
    expect(hidden.find((row) => row.id === passengerIds[0])).toBeUndefined();

    const retained = await prisma.passenger.findUnique({
      where: { id: passengerIds[0] },
      select: { removedAt: true },
    });
    expect(retained?.removedAt).not.toBeNull();

    await passengers.setPassengerRemoved(admin(), passengerIds[0], false);
    const visible = await passengers.listPassengers(admin(), tripIds[0]);
    expect(visible.find((row) => row.id === passengerIds[0])).toBeDefined();
  });

  it("denies a scoped operator account access to another operator's manifest", async () => {
    const other = await operators.createOperator(admin(), {
      code: `${RUN}-OP2`,
      name: "Other Operator",
    });
    operatorIds.push(other.id);

    await expect(
      passengers.listPassengers(staff([other.id]), tripIds[0]),
    ).rejects.toThrow();

    await expect(
      passengers.createPassenger(staff([other.id]), tripIds[0], {
        passengerName: "Intruder",
        fatherName: "Father",
        identityType: "CNIC",
        identityNumber: "1730199999999",
        mobileNumber: "03009999999",
        permanentAddress: "Elsewhere",
      }),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Phase 5 — inspections and incidents
  // -------------------------------------------------------------------------

  it("records an inspection and refuses more operational cameras than recorded", async () => {
    const created = await inspections.createInspection(admin(), {
      siteName: `${RUN} Depot`,
      operatorId: operatorIds[0],
      cameraCount: "4",
      camerasOperational: "3",
      inspectionDate: "2026-06-02",
      result: "PASS_WITH_FINDINGS",
      findings: "One camera had a loose mount.",
    });
    inspectionIds.push(created.id);

    const stored = await prisma.inspection.findUnique({
      where: { id: created.id },
      select: { cameraCount: true, camerasOperational: true, result: true },
    });
    expect(stored?.camerasOperational).toBe(3);

    await expect(
      inspections.createInspection(admin(), {
        siteName: `${RUN} Depot 2`,
        operatorId: operatorIds[0],
        cameraCount: "2",
        camerasOperational: "5",
        result: "PASS",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Cameras are never asserted operational without an inspection record.
    const audited = await prisma.auditEvent.findFirst({
      where: { action: "inspection.created", targetId: created.id },
    });
    expect(audited).not.toBeNull();
  });

  it("records an incident with a factual description and audits it", async () => {
    const created = await incidents.createIncident(admin(), {
      reference: `${RUN}-INC1`,
      operatorId: operatorIds[0],
      tripId: tripIds[0],
      occurredOn: "2026-06-01T09:30",
      location: "Quetta terminal",
      category: "Delay",
      severity: "LOW",
      description:
        "The service departed 40 minutes late because of a scheduled road closure.",
      status: "REPORTED",
    });
    incidentIds.push(created.id);

    const stored = await prisma.incident.findUnique({
      where: { id: created.id },
      select: { status: true, severity: true },
    });
    expect(stored?.status).toBe("REPORTED");

    const audited = await prisma.auditEvent.findFirst({
      where: { action: "incident.created", targetId: created.id },
    });
    expect(audited).not.toBeNull();
  });

  it("hides another operator's incidents from a scoped list", async () => {
    const page = await incidents.listIncidents(staff([operatorIds[1]]), {
      page: 1,
      pageSize: 50,
      q: RUN,
    });
    expect(page.rows).toEqual([]);
  });
});
