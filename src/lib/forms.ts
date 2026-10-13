/**
 * Single import point for the shared form/error primitives used by newer
 * modules (user administration, hardening).
 *
 * The implementations live in `src/lib/transport/*` because that is where they
 * were first written; they are generic application helpers, not transport
 * concepts. Re-exporting here avoids new modules reaching into a
 * domain-specific path for something generic.
 */

export type {
  FieldSpec,
  FieldType,
  FormAction,
  FormState,
} from "@/lib/transport/form-types";
export { EMPTY_FORM_STATE } from "@/lib/transport/form-types";

export {
  ConflictError,
  NotFoundError,
  ValidationError,
  flattenZodError,
  formSuccess,
  formValuesFrom,
  parseSchema,
  toFormState,
} from "@/lib/transport/errors";
