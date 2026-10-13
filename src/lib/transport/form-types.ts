/**
 * Client-safe form contract shared by transport server actions and their
 * client forms. Imported by BOTH sides, so it must never pull in server-only
 * modules (Prisma, next/headers, session helpers).
 */

/** Result returned by every transport server action. */
export interface FormState {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string[]>;
  /** Echoed back so a failed submit never wipes the user's input. */
  values?: Record<string, string>;
  /**
   * A credential shown to the operator exactly ONCE (e.g. a generated initial
   * password). Deliberately not part of `values`, so it is never re-rendered
   * into a form field. Never persisted, logged or audited.
   */
  secretOnce?: string;
}

export const EMPTY_FORM_STATE: FormState = {
  ok: false,
  message: "",
  fieldErrors: {},
};

/** Input types supported by the declarative ResourceForm. */
export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "datetime-local"
  | "textarea"
  | "select";

/** One field in a declarative resource form. */
export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  /** Render the field across both columns. */
  wide?: boolean;
  min?: number;
  max?: number;
  step?: string;
}

/** A server action usable by `useActionState`. */
export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;
