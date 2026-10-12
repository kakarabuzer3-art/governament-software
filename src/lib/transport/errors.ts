/**
 * Typed errors and form-state helpers for the transport modules.
 *
 * Every server action returns a plain, serialisable `FormState` instead of
 * throwing at the client. This keeps error handling explicit, prevents internal
 * details (Prisma messages, SQL, stack traces) from reaching the browser, and
 * gives the UI consistent field-level validation messages.
 */
import { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/authz-errors";
import type { FormState } from "./form-types";

export type { FormState } from "./form-types";
export { EMPTY_FORM_STATE } from "./form-types";

/** 400 — invalid input. Carries per-field messages for the form. */
export class ValidationError extends Error {
  readonly status = 400;
  readonly fieldErrors: Record<string, string[]>;
  constructor(
    message = "Some values are invalid.",
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** 404 — the record does not exist, or is outside the caller's scope. */
export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Record not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** 409 — a uniqueness or relationship constraint was violated. */
export class ConflictError extends Error {
  readonly status = 409;
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ConflictError";
    this.field = field;
  }
}

/** Successful action result. */
export function formSuccess(message: string): FormState {
  return { ok: true, message, fieldErrors: {} };
}

/** Turn a Zod error into per-field messages. */
export function flattenZodError(
  error: z.ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

/** Parse with a Zod schema, converting failures into a ValidationError. */
export function parseSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "Some values are invalid. Correct the highlighted fields and try again.",
      flattenZodError(result.error),
    );
  }
  return result.data;
}

/**
 * Convert any thrown value into a safe FormState. Internal error text is never
 * forwarded: recognised errors keep their (already safe) message, everything
 * else collapses to a generic one.
 */
export function toFormState(error: unknown): FormState {
  if (error instanceof ValidationError) {
    return {
      ok: false,
      message: error.message,
      fieldErrors: error.fieldErrors,
    };
  }
  if (error instanceof ConflictError) {
    return {
      ok: false,
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
    };
  }
  if (error instanceof NotFoundError) {
    return { ok: false, message: error.message, fieldErrors: {} };
  }
  if (error instanceof ForbiddenError) {
    return {
      ok: false,
      message: "You do not have permission to perform this action.",
      fieldErrors: {},
    };
  }
  if (error instanceof UnauthorizedError) {
    return {
      ok: false,
      message: "Your session has expired. Sign in again.",
      fieldErrors: {},
    };
  }
  // Unknown/internal: log server-side, show nothing exploitable.
  console.error("[transport] unexpected error:", error);
  return {
    ok: false,
    message: "Something went wrong. No changes were saved.",
    fieldErrors: {},
  };
}

/** Copy the submitted string values out of FormData for echo-back. */
export function formValuesFrom(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
