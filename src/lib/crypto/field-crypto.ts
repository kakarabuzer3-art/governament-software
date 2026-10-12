/**
 * Encryption at rest for sensitive identity fields (Phase 4).
 *
 * WHAT THIS DOES
 *  - Encrypts passenger identity numbers, mobile numbers and permanent
 *    addresses with AES-256-GCM (authenticated encryption: tampering is
 *    detected on decrypt, not silently accepted).
 *  - Produces a KEYED fingerprint (HMAC-SHA256) for duplicate detection so the
 *    system never needs to decrypt in order to compare identities. A plain
 *    unkeyed hash would be unsuitable here: the CNIC value space is small
 *    enough to brute-force, so the digest must be keyed.
 *
 * WHAT THIS DOES NOT DO — read this before treating the module as production
 * ready for real personal data:
 *  - There is NO key-management service, NO automatic key rotation and NO
 *    split-knowledge/HSM protection. The key lives in a local environment
 *    variable. Production use requires a managed KMS with a documented
 *    rotation and revocation process, plus database-level encryption and an
 *    approved backup policy.
 *  - Encryption at rest does not remove the need for access control, audit
 *    logging, data minimisation and retention limits.
 *
 * FAIL CLOSED: if no usable key is configured, passenger writes are REFUSED
 * rather than silently stored in plaintext.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the recommended size for GCM
const KEY_BYTES = 32; // AES-256
const PAYLOAD_VERSION = "v1";

/** Thrown when sensitive data is handled without a configured key. */
export class FieldEncryptionUnavailableError extends Error {
  readonly status = 500;
  constructor(
    message = "Sensitive passenger data cannot be processed because FIELD_ENCRYPTION_KEY is not configured.",
  ) {
    super(message);
    this.name = "FieldEncryptionUnavailableError";
  }
}

/** Thrown when a stored ciphertext cannot be authenticated/decrypted. */
export class FieldDecryptionError extends Error {
  readonly status = 500;
  constructor(message = "Stored encrypted value could not be read.") {
    super(message);
    this.name = "FieldDecryptionError";
  }
}

/**
 * Parse a 32-byte key supplied as 64 hex characters or base64.
 * Returns null (never throws with the value in the message) when unusable.
 */
export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const buffer = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  return buffer.length === KEY_BYTES ? buffer : null;
}

/** The configured key, or null when absent/invalid. */
export function getFieldEncryptionKey(): Buffer | null {
  return parseEncryptionKey(process.env.FIELD_ENCRYPTION_KEY);
}

/** The configured key, or throw. Use before any sensitive write. */
export function requireFieldEncryptionKey(): Buffer {
  const key = getFieldEncryptionKey();
  if (!key) {
    throw new FieldEncryptionUnavailableError(
      "Passenger data cannot be stored or read: FIELD_ENCRYPTION_KEY is missing " +
        "or is not a 32-byte key (base64 or 64 hex characters). See .env.example.",
    );
  }
  return key;
}

/** Generate a fresh key for local development (printed to the operator only). */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/** Encrypt a value. Output format: `v1:<iv>:<authTag>:<ciphertext>` (base64). */
export function encryptField(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    PAYLOAD_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypt a value produced by `encryptField`. Throws on tampering. */
export function decryptField(payload: string, key: Buffer): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new FieldDecryptionError("Unrecognised encrypted value format.");
  }
  try {
    const iv = Buffer.from(parts[1], "base64");
    const authTag = Buffer.from(parts[2], "base64");
    const ciphertext = Buffer.from(parts[3], "base64");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Never echo the ciphertext or the key in the error.
    throw new FieldDecryptionError(
      "Stored encrypted value failed authentication and was not returned.",
    );
  }
}

/** True when the string looks like a payload produced by `encryptField`. */
export function isEncryptedPayload(value: string): boolean {
  return typeof value === "string" && value.startsWith(`${PAYLOAD_VERSION}:`) &&
    value.split(":").length === 4;
}

/**
 * Normalise an identity value before fingerprinting: digits only for numeric
 * identifiers, otherwise trimmed uppercase (e.g. passport numbers).
 */
export function normalizeIdentity(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 5 ? digits : value.trim().toUpperCase();
}

/**
 * Keyed digest used for duplicate detection WITHOUT decryption.
 * Truncated to 32 hex characters — ample for uniqueness checks.
 */
export function fingerprintField(value: string, key: Buffer): string {
  return createHmac("sha256", key)
    .update(normalizeIdentity(value))
    .digest("hex")
    .slice(0, 32);
}
