import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createCipheriv, randomBytes } from "node:crypto";
import {
  decryptField,
  encryptField,
  FieldDecryptionError,
  fingerprintField,
  generateEncryptionKey,
  getFingerprintKey,
  getKeyring,
  hasDedicatedFingerprintKey,
  isEncryptedPayload,
  isKeyringPayload,
  isOnPrimaryKey,
  keyIdFor,
  parseEncryptionKey,
  parseKeyring,
  requireFingerprintKey,
  requireKeyring,
} from "./field-crypto";

/**
 * Encryption + keyring tests (Phase 4, extended in Phase C for rotation).
 */

const KEY_A = Buffer.alloc(32, 7);
const KEY_B = Buffer.alloc(32, 9);
const KEY_C = Buffer.alloc(32, 11);

const keyringOf = (...keys: Buffer[]) => {
  const map = new Map<string, Buffer>();
  for (const key of keys) map.set(keyIdFor(key), key);
  const primaryId = [...map.keys()][0];
  return { primaryId, keys: map, rotating: map.size > 1 };
};

/** Build a LEGACY 4-part payload, as written before the keyring existed. */
function legacyEncrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

describe("parseEncryptionKey", () => {
  it("accepts a 32-byte base64 key and a 64-character hex key", () => {
    expect(parseEncryptionKey(randomBytes(32).toString("base64"))).not.toBeNull();
    expect(parseEncryptionKey("a".repeat(64))).not.toBeNull();
  });

  it("rejects missing, short and malformed values", () => {
    expect(parseEncryptionKey(undefined)).toBeNull();
    expect(parseEncryptionKey(null)).toBeNull();
    expect(parseEncryptionKey("")).toBeNull();
    expect(parseEncryptionKey("too-short")).toBeNull();
  });
});

describe("parseKeyring", () => {
  it("returns null when nothing usable is configured", () => {
    expect(parseKeyring(undefined, undefined).keyring).toBeNull();
    expect(parseKeyring("", "").keyring).toBeNull();
    expect(parseKeyring("not-a-key", undefined).keyring).toBeNull();
  });

  it("falls back to the single-key variable", () => {
    const { keyring } = parseKeyring(undefined, KEY_A.toString("base64"));
    expect(keyring).not.toBeNull();
    expect(keyring?.keys.size).toBe(1);
    expect(keyring?.rotating).toBe(false);
  });

  it("accepts an explicit id:key list and keeps the first as primary", () => {
    const { keyring } = parseKeyring(
      `newkey:${KEY_B.toString("base64")},oldkey:${KEY_A.toString("base64")}`,
      undefined,
    );
    expect(keyring?.primaryId).toBe("newkey");
    expect(keyring?.keys.size).toBe(2);
    expect(keyring?.rotating).toBe(true);
    expect(keyring?.keys.get("oldkey")).toEqual(KEY_A);
  });

  it("skips malformed entries and reports them", () => {
    const { keyring, skipped } = parseKeyring(
      `good:${KEY_A.toString("base64")},broken:short`,
      undefined,
    );
    expect(keyring?.keys.size).toBe(1);
    expect(skipped).toBe(1);
  });

  it("derives a stable id when none is given", () => {
    const { keyring } = parseKeyring(KEY_A.toString("base64"), undefined);
    expect(keyring?.primaryId).toBe(keyIdFor(KEY_A));
  });
});

describe("encrypt / decrypt with a keyring", () => {
  const keyring = keyringOf(KEY_A, KEY_B);

  it("round-trips a value", () => {
    expect(decryptField(encryptField("17301-1234567-1", keyring), keyring)).toBe(
      "17301-1234567-1",
    );
  });

  it("records the key id in the payload", () => {
    const payload = encryptField("value", keyring);
    expect(isKeyringPayload(payload)).toBe(true);
    expect(isEncryptedPayload(payload)).toBe(true);
    expect(payload.split(":")[1]).toBe(keyring.primaryId);
    expect(isOnPrimaryKey(payload, keyring)).toBe(true);
  });

  it("never embeds the plaintext", () => {
    const payload = encryptField("17301-1234567-1", keyring);
    expect(payload).not.toContain("17301-1234567-1");
    expect(payload).not.toContain("17301");
  });

  it("uses a fresh IV so identical values differ", () => {
    expect(encryptField("same", keyring)).not.toBe(encryptField("same", keyring));
  });

  it("detects tampering", () => {
    const parts = encryptField("17301-1234567-1", keyring).split(":");
    const body = parts[4];
    parts[4] = `${body.slice(0, -2)}${body.endsWith("AA") ? "BB" : "AA"}`;
    expect(() => decryptField(parts.join(":"), keyring)).toThrow(
      FieldDecryptionError,
    );
  });

  it("fails clearly when the recorded key is not configured", () => {
    const otherKeyring = keyringOf(KEY_C);
    const payload = encryptField("value", otherKeyring);
    expect(() => decryptField(payload, keyring)).toThrow(/not currently configured/);
  });

  it("rejects malformed payloads without leaking details", () => {
    expect(() => decryptField("not-encrypted", keyring)).toThrow(
      FieldDecryptionError,
    );
  });
});

describe("key rotation", () => {
  it("keeps reading values encrypted with the previous key during rotation", () => {
    const oldOnly = keyringOf(KEY_A);
    const payload = encryptField("17301-1234567-1", oldOnly);

    // Rotate: new key becomes primary, old key retained.
    const rotating = keyringOf(KEY_B, KEY_A);
    expect(decryptField(payload, rotating)).toBe("17301-1234567-1");
    // New writes use the new key.
    expect(isOnPrimaryKey(encryptField("x", rotating), rotating)).toBe(true);
  });

  it("reads LEGACY payloads (no key id) with whichever configured key matches", () => {
    const legacy = legacyEncrypt("17301-1234567-1", KEY_A);
    expect(isKeyringPayload(legacy)).toBe(false);
    expect(isEncryptedPayload(legacy)).toBe(true);

    // Only the OLD key is configured: readable.
    expect(decryptField(legacy, keyringOf(KEY_A))).toBe("17301-1234567-1");
    // Rotated keyring that retains the old key: still readable.
    expect(decryptField(legacy, keyringOf(KEY_B, KEY_A))).toBe("17301-1234567-1");
  });

  it("fails closed for a legacy payload when its key was removed", () => {
    const legacy = legacyEncrypt("17301-1234567-1", KEY_A);
    expect(() => decryptField(legacy, keyringOf(KEY_B, KEY_C))).toThrow(
      /original key may have been removed/,
    );
  });

  it("reports whether a payload already uses the primary key", () => {
    const rotating = keyringOf(KEY_B, KEY_A);
    const old = encryptField("x", keyringOf(KEY_A));
    expect(isOnPrimaryKey(old, rotating)).toBe(false);
    expect(isOnPrimaryKey(legacyEncrypt("x", KEY_A), rotating)).toBe(false);
  });
});

describe("fingerprint key", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.FIELD_FINGERPRINT_KEY;
    delete process.env.FIELD_ENCRYPTION_KEYS;
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("is keyed, deterministic and not the raw value", () => {
    expect(fingerprintField("17301-1234567-1", KEY_A)).toBe(
      fingerprintField("1730112345671", KEY_A),
    );
    expect(fingerprintField("1730112345671", KEY_A)).not.toBe(
      fingerprintField("1730112345671", KEY_B),
    );
    expect(fingerprintField("1730112345671", KEY_A)).not.toContain("1730112345671");
  });

  it("prefers a dedicated fingerprint key so encryption rotation does not break matching", () => {
    process.env.FIELD_ENCRYPTION_KEY = KEY_A.toString("base64");
    process.env.FIELD_FINGERPRINT_KEY = KEY_B.toString("base64");
    expect(hasDedicatedFingerprintKey()).toBe(true);
    expect(getFingerprintKey()).toEqual(KEY_B);
  });

  it("falls back to the primary encryption key", () => {
    process.env.FIELD_ENCRYPTION_KEY = KEY_A.toString("base64");
    expect(hasDedicatedFingerprintKey()).toBe(false);
    expect(getFingerprintKey()).toEqual(KEY_A);
  });

  it("throws a clear error when no key can be resolved", () => {
    expect(getFingerprintKey()).toBeNull();
    expect(() => requireFingerprintKey()).toThrow(/fingerprint/i);
  });
});

describe("key availability (fail closed)", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    delete process.env.FIELD_ENCRYPTION_KEYS;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("reports no keyring when nothing is configured", () => {
    expect(getKeyring()).toBeNull();
    expect(() => requireKeyring()).toThrow(/no usable encryption key/i);
  });

  it("resolves a keyring when a key is configured", () => {
    process.env.FIELD_ENCRYPTION_KEY = generateEncryptionKey();
    expect(requireKeyring().keys.size).toBe(1);
  });
});
