"use server";

/**
 * Server actions for user and access administration (Phase B).
 *
 * Every action starts by verifying the actor's permission against the database
 * (`assertPermission`). The service layer then re-validates the target and the
 * requested grants. Nothing submitted by the browser — user id, role key,
 * operator id, assign/revoke flag — is trusted.
 */
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/authorization";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac";
import { formSuccess, formValuesFrom, toFormState } from "@/lib/forms";
import type { FormState } from "@/lib/transport/form-types";
import * as users from "./service";
import { parseCreateUserForm } from "./validation";

async function adminContext(permission: PermissionKey) {
  const user = await assertPermission(permission);
  return { user };
}

/** Strip anything credential-like before echoing values back to the browser. */
function safeValues(formData: FormData): Record<string, string> {
  const values = formValuesFrom(formData);
  delete values.initialPassword;
  return values;
}

function revalidateUser(userId?: string): void {
  revalidatePath("/settings");
  if (userId) revalidatePath(`/settings/${userId}`);
}

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeValues(formData);
  try {
    const ctx = await adminContext(PERMISSIONS.USER_MANAGE);
    const result = await users.createUser(ctx, parseCreateUserForm(formData));
    revalidateUser();
    return {
      ok: true,
      message: "Account created. Share the initial password securely — it is shown only once.",
      fieldErrors: {},
      // Intentionally NOT placed in `values`.
      secretOnce: result.initialPassword,
    };
  } catch (error) {
    return { ...toFormState(error), values };
  }
}

export async function setUserDisabledAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeValues(formData);
  const userId = String(values.userId ?? "");
  const disabled = values.disabled === "true";
  try {
    const ctx = await adminContext(PERMISSIONS.USER_MANAGE);
    const result = await users.setUserDisabled(ctx, {
      userId,
      reason: values.reason,
    });
    revalidateUser(userId);
    const suffix =
      disabled && result.revokedSessions > 0
        ? ` ${result.revokedSessions} active session(s) were revoked.`
        : "";
    return formSuccess(
      `${disabled ? "Account disabled" : "Account re-enabled"}.${suffix}`,
    );
  } catch (error) {
    return { ...toFormState(error), values };
  }
}

export async function setUserRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeValues(formData);
  const userId = String(values.userId ?? "");
  const assign = values.assign === "true";
  try {
    const ctx = await adminContext(PERMISSIONS.ROLE_MANAGE);
    const result = await users.setUserRole(ctx, {
      userId,
      roleKey: values.roleKey,
      assign: values.assign,
    });
    revalidateUser(userId);
    const suffix =
      !assign && result.revokedSessions > 0
        ? ` ${result.revokedSessions} active session(s) were revoked because this user's permissions were reduced.`
        : "";
    return formSuccess(`${assign ? "Role assigned" : "Role removed"}.${suffix}`);
  } catch (error) {
    return { ...toFormState(error), values };
  }
}

export async function setUserOperatorScopeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeValues(formData);
  const userId = String(values.userId ?? "");
  const assign = values.assign === "true";
  try {
    const ctx = await adminContext(PERMISSIONS.USER_MANAGE);
    await users.setUserOperatorScope(ctx, {
      userId,
      operatorId: values.operatorId,
      assign: values.assign,
    });
    revalidateUser(userId);
    return formSuccess(
      `Operator scope ${assign ? "assigned" : "removed"}. This takes effect immediately.`,
    );
  } catch (error) {
    return { ...toFormState(error), values };
  }
}
