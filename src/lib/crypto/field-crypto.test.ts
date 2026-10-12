import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptField,
  encryptField,
  FieldDecryptionError,
  fingerprintField,
  generateEncryptionKey,
  getFieldEncryptionKey,
  isEncryptedPayload,
  normalizeIdentity,
  parseEncryptionKey,
  requireFieldEncryptionKey,
} from "./field-crypto";

const TEST_KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

describe("parseEncryptionKey", () => {
  it("accepts a 32-byte base64 key", () => {
    expect(parseEncryptionKey(randomBytes(32).toString("base64"))).not.toBeNull();
  });

  it("accepts a 64-character hex key", () => {
    expect(parseEncryptionKey("a".repeat(64))).not.toBeNull();
  });

  it("rejects missing, short and malformed keys", () => {
    expect(parseEncryptionKey(undefined)).toBeNull();
    expect(parseEncryptionKey(null)).toBeNull();
    expect(parseEncryptionKey("")).toBeNull();
    expect(parseEncryptionKey("too-short")).toBeNull();
  });

  it("generates usable keys", () => {
    expect(parseEncryptionKey(generateEncryptionKey())).not.toBeNull();
  });
});

describe("encryptField / decryptField", () => {
  it("round-trips a value", () => {
    const ciphertext = encryptField("17301-1234567-1", TEST_KEY);
    expect(decryptField(ciphertext, TEST_KEY)).toBe("17301-1234567-1");
  });

  it("never stores the plaintext in the ciphertext", () => {
    const plaintext = "17301-1234567-1";
    const ciphertext = encryptField(plaintext, TEST_KEY);
    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext).not.toContain("17301");
    expect(isEncryptedPayload(ciphertext)).toBe(true);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptField("same-value", TEST_KEY);
    const b = encryptField("same-value", TEST_KEY);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", () => {
    const ciphertext = encryptField("17301-1234567-1", TEST_KEY);
    expect(() => decryptField(ciphertext, OTHER_KEY)).toThrow(FieldDecryptionError);
  });

  it("detects tampering (authenticated encryption)", () => {
    const ciphertext = encryptField("17301-1234567-1", TEST_KEY);
    const parts = ciphertext.split(":");
    // Flip a character in the ciphertext body.
    const body = parts[3];
    parts[3] = `${body.slice(0, -2)}${body.endsWith("AA") ? "BB" : "AA"}`;
    expect(() => decryptField(parts.join(":"), TEST_KEY)).toThrow(
      FieldDecryptionError,
    );
  });

  it("rejects malformed payloads without leaking details", () => {
    expect(() => decryptField("not-encrypted", TEST_KEY)).toThrow(
      FieldDecryptionError,
    );
  });

  it("encrypts non-numeric values such as addresses", () => {
    const address = "House 12, Sample Street, Quetta";
    expect(decryptField(encryptField(address, TEST_KEY), TEST_KEY)).toBe(address);
  });
});

describe("fingerprintField", () => {
  it("is deterministic for the same identity", () => {
    expect(fingerprintField("17301-1234567-1", TEST_KEY)).toBe(
      fingerprintField("1730112345671", TEST_KEY),
    );
  });

  it("ignores punctuation and separators", () => {
    expect(normalizeIdentity("17301-1234567-1")).toBe("1730112345671");
  });

  it("differs for different identities", () => {
    expect(fingerprintField("17301-1234567-1", TEST_KEY)).not.toBe(
      fingerprintField("17301-1234567-2", TEST_KEY),
    );
  });

  it("is KEYED, so the digest cannot be precomputed without the key", () => {
    expect(fingerprintField("1730112345671", TEST_KEY)).not.toBe(
      fingerprintField("1730112345671", OTHER_KEY),
    );
  });

  it("does not contain the original value", () => {
    expect(fingerprintField("1730112345671", TEST_KEY)).not.toContain("1730112345671");
  });
});

describe("key availability (fail closed)", () => {
  it("throws a clear error when no key is configured", () => {
    const previous = process.env.FIELD_ENCRYPTION_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY;
    try {
      expect(getFieldEncryptionKey()).toBeNull();
      expect(() => requireFieldEncryptionKey()).toThrow(
        /FIELD_ENCRYPTION_KEY/,
      );
    } finally {
      if (previous !== undefined) process.env.FIELD_ENCRYPTION_KEY = previous;
    }
  });

  it("returns the key when configured", () => {
    const previous = process.env.FIELD_ENCRYPTION_KEY;
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY.toString("base64");
    try {
      expect(requireFieldEncryptionKey()).toHaveLength(32);
    } finally {
      if (previous === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
      else process.env.FIELD_ENCRYPTION_KEY = previous;
    }
  });
});
