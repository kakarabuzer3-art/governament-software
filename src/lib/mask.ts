/**
 * Masking helpers for sensitive identity values.
 *
 * These will be used from Phase 4 (passenger manifests) onwards so
 * that CNIC and mobile numbers are never shown in full in routine
 * table views. They are introduced in Phase 1 with unit tests so the
 * behaviour is verified before any personal data exists in the system.
 *
 * IMPORTANT: masking is a display control only — it does not replace
 * encryption at rest, access control, or audit logging (Phase 2/4).
 */

const MASK_CHAR = "\u2022"; // bullet •
const CNIC_DIGIT_COUNT = 13;
const MOBILE_DIGIT_COUNT = 11;

/**
 * Mask a Pakistani-style CNIC (XXXXX-XXXXXXX-X, 13 digits).
 * Keeps the first 5 and last 1 digit; hides the middle 7.
 * Returns a fully masked placeholder when the input is malformed.
 *
 * Example: "1730112345671" -> "17301-\u2022\u2022\u2022\u2022\u2022\u2022\u2022-1"
 */
export function maskCnic(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== CNIC_DIGIT_COUNT) {
    return MASK_CHAR.repeat(6);
  }
  const head = digits.slice(0, 5);
  const tail = digits.slice(-1);
  return `${head}-${MASK_CHAR.repeat(7)}-${tail}`;
}

/**
 * Mask a mobile number (11 digits, e.g. 03XXXXXXXXX).
 * Keeps the first 4 and last 2 digits.
 *
 * Example: "03001234567" -> "0300-\u2022\u2022\u2022\u2022\u2022\u202267"
 */
export function maskMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== MOBILE_DIGIT_COUNT) {
    return MASK_CHAR.repeat(6);
  }
  const head = digits.slice(0, 4);
  const tail = digits.slice(-2);
  return `${head}-${MASK_CHAR.repeat(5)}${tail}`;
}

/**
 * Reveal only the last N characters of any identifier, e.g. a permit
 * number, when the full value must stay hidden in lists.
 */
export function maskTail(value: string, visibleTail = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) {
    return MASK_CHAR.repeat(Math.max(trimmed.length, 4));
  }
  return `${MASK_CHAR.repeat(Math.min(trimmed.length - visibleTail, 8))}${trimmed.slice(-visibleTail)}`;
}
