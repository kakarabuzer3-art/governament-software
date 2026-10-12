/**
 * Passenger manifest records — server-side business logic (Phase 4).
 *
 * PRIVACY RULES ENFORCED HERE (verified by tests):
 *  - Identity number, mobile number and permanent address are ENCRYPTED with
 *    AES-256-GCM before they touch the database. If no encryption key is
 *    configured the write is REFUSED (fail closed) — never stored in plaintext.
 *  - Only masked display values are exposed by list queries. The encrypted
 *    columns are never selected for the UI.
 *  - Revealing a full identity requires the MANIFEST_MANAGE permission and
 *    writes a `passenger.revealed` audit event. No passenger value is ever
 *    written to the audit log, a log line, or an error message.
 *  - Records are withdrawn with `removedAt`, never destroyed.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  encryptField,
  fingerprintField,
  decryptField,
  requireFieldEncryptionKey,
} from "@/lib/crypto/field-crypto";
import { maskCnic, maskMobile, maskTail } from "@/lib/mask";
import { ConflictError, NotFoundError, parseSchema } from "./errors";
import { auditChange } from "./crud";
import { actorRoleOf } from "./scope";
import type { TransportContext } from "./context";
import { getTripOrThrow } from "./trips";
import { passengerSchema } from "./validation";

export const PASSENGER_AUDIT = {
  CREATED: "passenger.created",
  UPDATED: "passenger.updated",
  REMOVED: "passenger.removed",
  RESTORED: "passenger.restored",
  REVEALED: "passenger.revealed",
} as const;

/** Display-safe projection: NO encrypted column is ever selected. */
export const passengerListSelect = {
  id: true,
  tripId: true,
  passengerName: true,
  fatherName: true,
  identityType: true,
  identityMasked: true,
  mobileMasked: true,
  removedAt: true,
  createdAt: true,
} satisfies Prisma.PassengerSelect;

export type PassengerListRow = Prisma.PassengerGetPayload<{
  select: typeof passengerListSelect;
}>;

/** Mask an identity value for display, by document type. */
export function maskIdentity(type: string, value: string): string {
  if (type === "CNIC") return maskCnic(value);
  return maskTail(value, 4);
}

export async function listPassengers(
  ctx: TransportContext,
  tripId: string,
  options: { includeRemoved?: boolean } = {},
): Promise<PassengerListRow[]> {
  // Scope check: throws when the trip is outside the caller's operator scope.
  await getTripOrThrow(ctx, tripId);

  return prisma.passenger.findMany({
    where: {
      tripId,
      ...(options.includeRemoved ? {} : { removedAt: null }),
    },
    select: passengerListSelect,
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function createPassenger(
  ctx: TransportContext,
  tripId: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getTripOrThrow(ctx, tripId);
  const data = parseSchema(passengerSchema, input);
  // Fails closed when FIELD_ENCRYPTION_KEY is missing or unusable.
  const key = requireFieldEncryptionKey();

  const fingerprint = fingerprintField(data.identityNumber, key);
  const duplicate = await prisma.passenger.findUnique({
    where: { tripId_identityFingerprint: { tripId, identityFingerprint: fingerprint } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError(
      "A passenger with this identity document is already on this journey's manifest.",
      "identityNumber",
    );
  }

  try {
    const created = await prisma.passenger.create({
      data: {
        tripId,
        passengerName: data.passengerName,
        fatherName: data.fatherName,
        identityType: data.identityType,
        identityNumberEncrypted: encryptField(data.identityNumber, key),
        identityFingerprint: fingerprint,
        identityMasked: maskIdentity(data.identityType, data.identityNumber),
        mobileEncrypted: encryptField(data.mobileNumber, key),
        mobileMasked: maskMobile(data.mobileNumber),
        permanentAddressEncrypted: encryptField(data.permanentAddress, key),
      },
      select: { id: true },
    });
    await auditChange({
      action: PASSENGER_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    // Unique constraint race on (tripId, identityFingerprint).
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictError(
        "A passenger with this identity document is already on this journey's manifest.",
        "identityNumber",
      );
    }
    throw error;
  }
}

export async function updatePassenger(
  ctx: TransportContext,
  passengerId: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const existing = await loadPassengerForWrite(ctx, passengerId);
  const data = parseSchema(passengerSchema, input);
  const key = requireFieldEncryptionKey();

  const fingerprint = fingerprintField(data.identityNumber, key);
  const duplicate = await prisma.passenger.findFirst({
    where: {
      tripId: existing.tripId,
      identityFingerprint: fingerprint,
      id: { not: passengerId },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError(
      "Another passenger on this journey already uses this identity document.",
      "identityNumber",
    );
  }

  const updated = await prisma.passenger.update({
    where: { id: passengerId },
    data: {
      passengerName: data.passengerName,
      fatherName: data.fatherName,
      identityType: data.identityType,
      identityNumberEncrypted: encryptField(data.identityNumber, key),
      identityFingerprint: fingerprint,
      identityMasked: maskIdentity(data.identityType, data.identityNumber),
      mobileEncrypted: encryptField(data.mobileNumber, key),
      mobileMasked: maskMobile(data.mobileNumber),
      permanentAddressEncrypted: encryptField(data.permanentAddress, key),
    },
    select: { id: true },
  });
  await auditChange({
    action: PASSENGER_AUDIT.UPDATED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: updated.id,
  });
  return updated;
}

/**
 * Withdraw or restore a manifest entry. The row is retained either way: this is
 * controlled correction, not deletion.
 */
export async function setPassengerRemoved(
  ctx: TransportContext,
  passengerId: string,
  removed: boolean,
): Promise<void> {
  const existing = await loadPassengerForWrite(ctx, passengerId);
  await prisma.passenger.update({
    where: { id: passengerId },
    data: { removedAt: removed ? new Date() : null },
    select: { id: true },
  });
  await auditChange({
    action: removed ? PASSENGER_AUDIT.REMOVED : PASSENGER_AUDIT.RESTORED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: existing.id,
  });
}

export interface RevealedPassenger {
  id: string;
  passengerName: string;
  fatherName: string;
  identityType: string;
  identityNumber: string;
  mobileNumber: string;
  permanentAddress: string;
}

/**
 * Decrypt one passenger's sensitive fields for an authorised user.
 *
 * The caller must already have been checked for MANIFEST_MANAGE. Every reveal
 * is audited. The returned values are deliberately NOT logged or included in
 * the audit event.
 */
export async function revealPassenger(
  ctx: TransportContext,
  passengerId: string,
): Promise<RevealedPassenger> {
  const passenger = await prisma.passenger.findUnique({
    where: { id: passengerId },
    select: {
      id: true,
      tripId: true,
      passengerName: true,
      fatherName: true,
      identityType: true,
      identityNumberEncrypted: true,
      mobileEncrypted: true,
      permanentAddressEncrypted: true,
    },
  });
  if (!passenger) throw new NotFoundError("Passenger record not found.");

  // Scope check through the owning trip.
  await getTripOrThrow(ctx, passenger.tripId);

  const key = requireFieldEncryptionKey();
  const revealed: RevealedPassenger = {
    id: passenger.id,
    passengerName: passenger.passengerName,
    fatherName: passenger.fatherName,
    identityType: passenger.identityType,
    identityNumber: decryptField(passenger.identityNumberEncrypted, key),
    mobileNumber: decryptField(passenger.mobileEncrypted, key),
    permanentAddress: decryptField(passenger.permanentAddressEncrypted, key),
  };

  await auditChange({
    action: PASSENGER_AUDIT.REVEALED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: passenger.id,
  });

  return revealed;
}

/** Load a passenger and confirm its trip is inside the caller's scope. */
async function loadPassengerForWrite(
  ctx: TransportContext,
  passengerId: string,
): Promise<{ id: string; tripId: string }> {
  const passenger = await prisma.passenger.findUnique({
    where: { id: passengerId },
    select: { id: true, tripId: true },
  });
  if (!passenger) throw new NotFoundError("Passenger record not found.");
  await getTripOrThrow(ctx, passenger.tripId);
  return passenger;
}
