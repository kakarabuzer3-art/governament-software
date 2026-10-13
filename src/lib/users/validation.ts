/**
 * Validation for user administration (Phase B).
 *
 * All of this runs on the SERVER. The browser sends a normal form; nothing it
 * submits is trusted, including role keys, operator ids and user ids.
 */
import { z } from "zod";
import {
  MAX_PASSWORD_LENGTH,
  passwordPolicyError,
} from "@/lib/passwords";

/** Derived account status shown in the UI (not a stored column). */
export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const emailField = z
  .string()
  .trim()
  .min(1, "An email address is required.")
  .max(190, "The email address is too long.")
  .pipe(z.email("Enter a valid email address."))
  .transform((value) => value.toLowerCase());

export const nameField = z
  .string()
  .trim()
  .min(2, "The full name must be at least 2 characters.")
  .max(120, "The full name must be at most 120 characters.");

/** Optional password the administrator may choose instead of a generated one. */
export const optionalPasswordField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .max(MAX_PASSWORD_LENGTH, "That password is too long.")
    .optional(),
);

export const roleKeysField = z
  .array(z.string().trim().min(1).max(60))
  .max(8, "Too many roles were selected.")
  .default([]);

export const operatorIdsField = z
  .array(z.string().trim().min(1).max(191))
  .max(50, "Too many operators were selected.")
  .default([]);

export const createUserSchema = z
  .object({
    name: nameField,
    email: emailField,
    roleKeys: roleKeysField,
    operatorIds: operatorIdsField,
    initialPassword: optionalPasswordField,
    reason: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  })
  .superRefine((value, ctx) => {
    if (!value.initialPassword) return;
    const error = passwordPolicyError(value.initialPassword);
    if (error) {
      ctx.addIssue({
        code: "custom",
        path: ["initialPassword"],
        message: error,
      });
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const disableUserSchema = z.object({
  userId: z.string().trim().min(1, "A user must be selected.").max(191),
  reason: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(200, "The reason must be at most 200 characters.").optional(),
  ),
});

export const roleChangeSchema = z.object({
  userId: z.string().trim().min(1).max(191),
  roleKey: z.string().trim().min(1, "A role must be selected.").max(60),
  assign: z.enum(["true", "false"]),
});

export const operatorScopeSchema = z.object({
  userId: z.string().trim().min(1).max(191),
  operatorId: z.string().trim().min(1, "An operator must be selected.").max(191),
  assign: z.enum(["true", "false"]),
});

/**
 * Build the create-user input from a submitted form.
 *
 * Checkbox groups arrive as repeated values, so `getAll` is required — a naive
 * `Object.fromEntries` would silently keep only the last role selected.
 */
export function parseCreateUserForm(formData: FormData): unknown {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    email: text("email"),
    roleKeys: formData.getAll("roleKeys").filter((v): v is string => typeof v === "string"),
    operatorIds: formData
      .getAll("operatorIds")
      .filter((v): v is string => typeof v === "string"),
    initialPassword: text("initialPassword"),
    reason: text("reason"),
  };
}
