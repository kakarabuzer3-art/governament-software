/**
 * Encryption-key rotation for passenger identity fields.
 *
 * Usage (PowerShell, from the project root):
 *   npm run keys:rotate -- --verify    # check every row decrypts; writes nothing
 *   npm run keys:rotate -- --dry-run   # default: report what WOULD change
 *   npm run keys:rotate -- --apply     # re-encrypt onto the primary key
 *   npm run keys:rotate -- --apply --force   # also rewrite rows already current
 *
 * WHAT IT DOES
 *  - Decrypts each passenger's identity number, mobile number and address with
 *    the configured keyring (legacy, key-id-less payloads included).
 *  - Re-encrypts them with the keyring's PRIMARY key, so the payload records the
 *    new key id.
 *  - Recomputes the identity fingerprint with the current fingerprint key, so
 *    duplicate detection keeps working after a rotation.
 *  - Reports counts only. It NEVER prints a decrypted value, a key or a ciphertext.
 *
 * SAFETY
 *  - Defaults to a dry run. `--apply` must be passed explicitly.
 *  - Rows that cannot be decrypted are SKIPPED and counted, never overwritten.
 *    That protects data when a key is missing from the keyring.
 *  - No row is ever deleted.
 *
 * PREREQUISITE: put the new key FIRST in FIELD_ENCRYPTION_KEYS and keep the old
 * key in the same list until `--verify` reports zero failures.
 */
import "../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import {
  decryptField,
  encryptField,
  fingerprintField,
  getFingerprintKey,
  getKeyring,
  hasDedicatedFingerprintKey,
  isOnPrimaryKey,
} from "../src/lib/crypto/field-crypto";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verifyOnly = args.has("--verify");
const force = args.has("--force");

const BATCH_SIZE = 200;

interface Stats {
  examined: number;
  alreadyCurrent: number;
  reEncrypted: number;
  fingerprintUpdated: number;
  undecryptable: number;
  writeFailures: number;
}

async function main(): Promise<void> {
  const keyring = getKeyring();
  if (!keyring) {
    console.error(
      "[rotate] No usable encryption keyring is configured. Set " +
        "FIELD_ENCRYPTION_KEYS (or FIELD_ENCRYPTION_KEY) before running this tool.",
    );
    process.exitCode = 1;
    return;
  }

  const fingerprintKey = getFingerprintKey();
  if (!fingerprintKey) {
    console.warn(
      "[rotate] No fingerprint key could be resolved; fingerprints will NOT be " +
        "recomputed. Set FIELD_FINGERPRINT_KEY to make rotation safe.",
    );
  }

  const mode = verifyOnly ? "VERIFY" : apply ? "APPLY" : "DRY RUN";
  console.log(`[rotate] Mode: ${mode}`);
  console.log(
    `[rotate] Keyring: ${keyring.keys.size} key(s) configured` +
      (keyring.rotating ? " (rotation in progress)" : "") +
      `; primary id ${keyring.primaryId}.`,
  );
  console.log(
    `[rotate] Fingerprint key: ${
      hasDedicatedFingerprintKey() ? "dedicated" : "derived from primary encryption key"
    }.`,
  );

  const stats: Stats = {
    examined: 0,
    alreadyCurrent: 0,
    reEncrypted: 0,
    fingerprintUpdated: 0,
    undecryptable: 0,
    writeFailures: 0,
  };

  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.passenger.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        tripId: true,
        identityNumberEncrypted: true,
        mobileEncrypted: true,
        permanentAddressEncrypted: true,
        identityFingerprint: true,
      },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      stats.examined += 1;

      let identity: string;
      let mobile: string;
      let address: string;
      try {
        identity = decryptField(row.identityNumberEncrypted, keyring);
        mobile = decryptField(row.mobileEncrypted, keyring);
        address = decryptField(row.permanentAddressEncrypted, keyring);
      } catch {
        stats.undecryptable += 1;
        console.warn(
          `[rotate] SKIPPED passenger ${row.id}: a required key is not configured.`,
        );
        continue;
      }

      if (verifyOnly) continue;

      const current =
        isOnPrimaryKey(row.identityNumberEncrypted, keyring) &&
        isOnPrimaryKey(row.mobileEncrypted, keyring) &&
        isOnPrimaryKey(row.permanentAddressEncrypted, keyring);

      if (current && !force) {
        stats.alreadyCurrent += 1;
        continue;
      }

      const nextFingerprint = fingerprintKey
        ? fingerprintField(identity, fingerprintKey)
        : row.identityFingerprint;
      const fingerprintChanged = nextFingerprint !== row.identityFingerprint;

      if (fingerprintChanged) stats.fingerprintUpdated += 1;

      if (!apply) {
        stats.reEncrypted += 1;
        continue;
      }

      try {
        await prisma.passenger.update({
          where: { id: row.id },
          data: {
            identityNumberEncrypted: encryptField(identity, keyring),
            mobileEncrypted: encryptField(mobile, keyring),
            permanentAddressEncrypted: encryptField(address, keyring),
            identityFingerprint: nextFingerprint,
          },
          select: { id: true },
        });
        stats.reEncrypted += 1;
      } catch (error) {
        stats.writeFailures += 1;
        console.error(
          `[rotate] FAILED to update passenger ${row.id}: ${
            error instanceof Error ? error.name : "unknown error"
          }`,
        );
      }
    }
  }

  console.log("[rotate] Summary");
  console.log(`  passengers examined      : ${stats.examined}`);
  console.log(`  already on primary key   : ${stats.alreadyCurrent}`);
  console.log(`  ${apply ? "re-encrypted" : "would re-encrypt"}          : ${stats.reEncrypted}`);
  console.log(`  fingerprints to update   : ${stats.fingerprintUpdated}`);
  console.log(`  UNDECRYPTABLE (skipped)  : ${stats.undecryptable}`);
  console.log(`  write failures           : ${stats.writeFailures}`);

  if (verifyOnly) {
    console.log(
      stats.undecryptable === 0
        ? "[rotate] VERIFY OK: every passenger row decrypted with the configured keyring."
        : "[rotate] VERIFY FAILED: some rows need a key that is not configured. " +
            "Restore that key before removing it from FIELD_ENCRYPTION_KEYS.",
    );
  } else if (!apply) {
    console.log(
      "[rotate] DRY RUN: nothing was written. Re-run with --apply to perform the rotation.",
    );
  }

  if (stats.undecryptable > 0 || stats.writeFailures > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      "[rotate] Failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
