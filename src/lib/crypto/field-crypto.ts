/**
 * Encryption at rest for sensitive identity fields (Phase 4, hardened with a
 * keyring in Phase C — see docs/COMPLETION_GAP_AUDIT.md GAP-07).
 *
 * WHAT THIS DOES
 *  - Encrypts passenger identity numbers, mobile numbers and permanent
 *    addresses with AES-256-GCM (authenticated encryption: tampering is
 *    detected on decrypt, not silently accepted).
 *  - Produces a KEYED fingerprint (HMAC-SHA256) for duplicate detection so the
 *    system never needs to decrypt in order to compare identities.
 *  - Supports a KEYRING: several keys can be configured at once, and every new
 *    payload records which key encrypted it. That is what makes rotation
 *    possible without losing data.
 *
 * PAYLOAD FORMATS
 *  - Current: `v1:<keyId>:<iv>:<tag>:<ciphertext>` (all base64 after keyId).
 *  - Legacy:  `v1:<iv>:<tag>:<ciphertext>` — written before the keyring
 *    existed, so it carries no key id. Legacy payloads are decrypted by trying
 *    each configured key in turn (a wrong key fails the GCM authentication tag,
 *    so guessing is safe). `scripts/rotate-field-keys.ts` migrates them.
 *
 * ROTATION PROCEDURE (see docs/PHASE_9_INSTALLATION_HANDOVER.md)
 *  1. Generate a new key and put BOTH keys in `FIELD_ENCRYPTION_KEYS`, new key
 *     FIRST (it becomes the primary). Do not remove the old key yet.
 *  2. Run `npm run keys:rotate -- --verify` then `-- --dry-run`, then `-- --apply`.
 *  3. Confirm with `-- --verify` that no row needs the old key any more.
 *  4. Only then remove the old key from the environment.
 *  Losing every key makes existing ciphertext unreadable. There is no recovery
 *  backdoor — keep an escrowed copy in an approved secret store.
 *
 * WHAT THIS DOES NOT DO — read before treating it as production ready:
 *  - There is NO key-management service, NO HSM and NO automatic expiry or
 *    revocation. Keys live in environment variables.
 *  - There is no database-level encryption and no encrypted backup pipeline.
 *  - Encryption at rest does not replace access control, audit, minimisation
 *    or retention limits.
 *
 * FAIL CLOSED: if no usable key is configured, sensitive writes are REFUSED
 * rather than silently stored in plaintext.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
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
    message = "Sensitive passenger data cannot be processed because no encryption key is configured.",
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

/** A set of keys: an active primary plus any retained older keys. */
export interface Keyring {
  /** Key id used for all NEW encryptions. */
  primaryId: string;
  /** keyId -> 32-byte key. */
  keys: Map<string, Buffer>;
  /** True when more than one key is configured (rotation in progress). */
  rotating: boolean;
}

// ---------------------------------------------------------------------------
// Key parsing
// ---------------------------------------------------------------------------

/**
 * Parse a 32-byte key supplied as 64 hex characters or base64.
 * Returns null (never an error containing the value) when unusable.
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

/**
 * Short, deterministic identifier for a key. Derived from a hash of the KEY
 * itself, so it is stable across restarts without any extra configuration, and
 * it does not reveal the key.
 */
export function keyIdFor(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/**
 * Build a keyring from the environment.
 *
 * `FIELD_ENCRYPTION_KEYS` (preferred) is a comma-separated list of
 * `id:key` or bare `key` entries. The FIRST usable entry becomes the primary.
 * `FIELD_ENCRYPTION_KEY` is supported for backwards compatibility and for
 * single-key setups.
 *
 * Entries that cannot be parsed are skipped and reported, never silently
 * trusted as a different key.
 */
export function parseKeyring(
  rawKeys: string | undefined | null,
  rawSingle: string | undefined | null,
): { keyring: Keyring | null; skipped: number } {
  const keys = new Map<string, Buffer>();
  let skipped = 0;

  const add = (id: string | undefined, keyText: string): void => {
    const key = parseEncryptionKey(keyText);
    if (!key) {
      skipped += 1;
      return;
    }
    // An explicit id wins; otherwise derive one from the key material.
    const keyId = id && id.trim() ? id.trim() : keyIdFor(key);
    if (!keys.has(keyId)) keys.set(keyId, key);
  };

  const list = (rawKeys ?? "").trim();
  if (list) {
    for (const entry of list.split(",")) {
      const item = entry.trim();
      if (!item) continue;
      const separator = item.indexOf(":");
      if (separator > 0 && separator < item.length - 1) {
        add(item.slice(0, separator), item.slice(separator + 1));
      } else {
        add(undefined, item);
      }
    }
  }

  if (keys.size === 0 && rawSingle?.trim()) {
    add(undefined, rawSingle);
  }

  if (keys.size === 0) return { keyring: null, skipped };

  const primaryId = [...keys.keys()][0];
  return {
    keyring: { primaryId, keys, rotating: keys.size > 1 },
    skipped,
  };
}

/** The configured keyring, or null when absent/unusable. */
export function getKeyring(): Keyring | null {
  return parseKeyring(
    process.env.FIELD_ENCRYPTION_KEYS,
    process.env.FIELD_ENCRYPTION_KEY,
  ).keyring;
}

/** The configured keyring, or throw. Use before any sensitive write. */
export function requireKeyring(): Keyring {
  const keyring = getKeyring();
  if (!keyring) {
    throw new FieldEncryptionUnavailableError(
      "Passenger data cannot be stored or read: no usable encryption key is " +
        "configured. Set FIELD_ENCRYPTION_KEY to a 32-byte key (base64 or 64 " +
        "hex characters), or FIELD_ENCRYPTION_KEYS for rotation. See .env.example.",
    );
  }
  return keyring;
}

/** The primary key, or throw. Kept for callers that only need one key. */
export function requireFieldEncryptionKey(): Buffer {
  return requireKeyring().keys.get(requireKeyring().primaryId) as Buffer;
}

/** Alias kept for existing callers. */
export function getFieldEncryptionKey(): Buffer | null {
  const keyring = getKeyring();
  if (!keyring) return null;
  return keyring.keys.get(keyring.primaryId) ?? null;
}

/** Generate a fresh key for local development. */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt
// ---------------------------------------------------------------------------

/** Encrypt a value with the keyring's PRIMARY key. */
export function encryptField(plaintext: string, keyring: Keyring): string {
  const key = keyring.keys.get(keyring.primaryId);
  if (!key) {
    throw new FieldEncryptionUnavailableError(
      "The configured primary encryption key could not be resolved.",
    );
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    PAYLOAD_VERSION,
    keyring.primaryId,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** True when the value is a keyring payload (5 parts) rather than legacy. */
export function isKeyringPayload(payload: string): boolean {
  return (
    typeof payload === "string" &&
    payload.startsWith(`${PAYLOAD_VERSION}:`) &&
    payload.split(":").length === 5
  );
}

/** True for either payload format. */
export function isEncryptedPayload(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!value.startsWith(`${PAYLOAD_VERSION}:`)) return false;
  const parts = value.length > 0 ? value.split(":") : [];
  return parts.length === 4 || parts.length === 5;
}

function decryptWith(
  keyId: string,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer,
): string {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    // Never echo the ciphertext, the key id or the key.
    throw new FieldDecryptionError(
      "Stored encrypted value failed authentication and was not returned.",
    );
  }
}

/**
 * Decrypt a value produced by `encryptField`, in either payload format.
 *
 * Keyring payloads use their recorded key id. Legacy payloads have no key id,
 * so each configured key is tried in turn; the GCM tag makes a wrong key fail
 * closed, so this is safe and lets legacy rows survive a rotation.
 */
export function decryptField(payload: string, keyring: Keyring): string {
  const parts = payload.split(":");
  if (parts[0] !== PAYLOAD_VERSION) {
    throw new FieldDecryptionError("Unrecognised encrypted value format.");
  }

  if (parts.length === 5) {
    const [, keyId, ivB64, tagB64, ctB64] = parts;
    const key = keyring.keys.get(keyId);
    if (!key) {
      throw new FieldDecryptionError(
        "This value was encrypted with a key that is not currently configured. " +
          "Restore that key to read the record; do not delete it.",
      );
    }
    return decryptWith(
      keyId,
      key,
      Buffer.from(ivB64, "base64"),
      Buffer.from(tagB64, "base64"),
      Buffer.from(ctB64, "base64"),
    );
  }

  if (parts.length === 4) {
    const [, ivB64, tagB64, ctB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ctB64, "base64");
    for (const [keyId, key] of keyring.keys) {
      try {
        return decryptWith(keyId, key, iv, authTag, ciphertext);
      } catch {
        // Try the next configured key.
      }
    }
    throw new FieldDecryptionError(
      "This legacy value could not be read with any configured key. The " +
        "original key may have been removed.",
    );
  }

  throw new FieldDecryptionError("Unrecognised encrypted value format.");
}

/** True when the value is already encrypted under the keyring's primary key. */
export function isOnPrimaryKey(payload: string, keyring: Keyring): boolean {
  if (!isKeyringPayload(payload)) return false;
  return payload.split(":")[1] === keyring.primaryId;
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

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

/**
 * Key used for identity fingerprints.
 *
 * Prefers a DEDICATED `FIELD_FINGERPRINT_KEY` so that rotating the encryption
 * key does not invalidate duplicate detection. Falling back to the primary
 * encryption key keeps existing deployments working; in that case the rotation
 * script must recompute fingerprints, and it does.
 */
export function getFingerprintKey(): Buffer | null {
  const dedicated = parseEncryptionKey(process.env.FIELD_FINGERPRINT_KEY);
  if (dedicated) return dedicated;
  const keyring = getKeyring();
  if (!keyring) return null;
  return keyring.keys.get(keyring.primaryId) ?? null;
}

/** True when fingerprints use their own dedicated key. */
export function hasDedicatedFingerprintKey(): boolean {
  return parseEncryptionKey(process.env.FIELD_FINGERPRINT_KEY) !== null;
}

/** The fingerprint key, or throw. */
export function requireFingerprintKey(): Buffer {
  const key = getFingerprintKey();
  if (!key) {
    throw new FieldEncryptionUnavailableError(
      "Passenger duplicates cannot be detected because no fingerprint key is " +
        "configured. Set FIELD_FINGERPRINT_KEY (preferred) or an encryption key.",
    );
  }
  return key;
}
