"use client";

/**
 * Account creation form (Phase B).
 *
 * On success the server returns a GENERATED initial password in
 * `secretOnce`. It is rendered here in a dedicated panel, never as a form
 * field, so it is not re-submitted or auto-filled. The administrator is told in
 * plain language that it is shown once and must be shared securely.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createUserAction } from "@/lib/users/actions";
import type { FormState } from "@/lib/transport/form-types";

export interface RoleOption {
  key: string;
  name: string;
  description: string;
}

export interface OperatorOption {
  id: string;
  code: string;
  name: string;
}

export interface CreateUserFormProps {
  roles: RoleOption[];
  operators: OperatorOption[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--primary" disabled={pending}>
      {pending ? "Creating…" : "Create account"}
    </button>
  );
}

export function CreateUserForm({ roles, operators }: CreateUserFormProps) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createUserAction,
    { ok: false, message: "", fieldErrors: {} },
  );

  const errorFor = (field: string) => state.fieldErrors[field] ?? [];

  return (
    <section className="panel glass" aria-labelledby="create-user-heading">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="create-user-heading">
            Create an account
          </h3>
          <p className="panel-subtitle">
            There is no public sign-up. Accounts are created here by an
            administrator.
          </p>
        </div>
      </div>

      <form action={formAction} className="resource-form" noValidate>
        {state.message ? (
          <p
            className={state.ok ? "form-success" : "login-error"}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}

        {state.secretOnce ? (
          <div className="secret-panel" role="status">
            <p className="secret-panel-title">Initial password — shown only once</p>
            <p className="secret-panel-value masked-value">{state.secretOnce}</p>
            <p className="field-help">
              Copy it now and hand it to the account holder through a secure
              channel. It is not stored anywhere and cannot be retrieved later.
              Ask them to change it after first sign-in.
            </p>
          </div>
        ) : null}

        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="name">
              Full name <span aria-hidden="true">*</span>
            </label>
            <input
              id="name"
              name="name"
              className="input"
              required
              autoComplete="off"
              aria-invalid={errorFor("name").length > 0}
            />
            {errorFor("name").map((message) => (
              <p className="field-error" key={message} role="alert">
                {message}
              </p>
            ))}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="email">
              Email address <span aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              required
              autoComplete="off"
              aria-invalid={errorFor("email").length > 0}
            />
            {errorFor("email").map((message) => (
              <p className="field-error" key={message} role="alert">
                {message}
              </p>
            ))}
          </div>

          <div className="field field--wide">
            <label className="field-label" htmlFor="initialPassword">
              Initial password (optional)
            </label>
            <input
              id="initialPassword"
              name="initialPassword"
              type="password"
              className="input"
              autoComplete="new-password"
              aria-invalid={errorFor("initialPassword").length > 0}
              aria-describedby="initialPassword-help"
            />
            <p className="field-help" id="initialPassword-help">
              Leave blank to have a strong password generated and displayed once.
              If you set one, it must be at least 12 characters and not a
              well-known placeholder.
            </p>
            {errorFor("initialPassword").map((message) => (
              <p className="field-error" key={message} role="alert">
                {message}
              </p>
            ))}
          </div>

          <fieldset className="field field--wide choice-set">
            <legend className="field-label">
              Provisional roles
            </legend>
            <p className="field-help">
              Roles are provisional and require departmental confirmation. You
              cannot grant a role containing permissions you do not hold.
            </p>
            {roles.map((role) => (
              <label className="choice" key={role.key}>
                <input type="checkbox" name="roleKeys" value={role.key} />
                <span>
                  <strong>{role.name}</strong>
                  <span className="cell-hint"> — {role.description}</span>
                </span>
              </label>
            ))}
            {errorFor("roleKeys").map((message) => (
              <p className="field-error" key={message} role="alert">
                {message}
              </p>
            ))}
          </fieldset>

          <fieldset className="field field--wide choice-set">
            <legend className="field-label">Operator scope</legend>
            <p className="field-help">
              Assigning an operator limits an operator-staff account to that
              operator&apos;s records. Leaving this empty means the account sees
              no operator records at all.
            </p>
            {operators.length === 0 ? (
              <p className="cell-hint">
                No operators exist yet. Create one from the Operators module
                first.
              </p>
            ) : (
              operators.map((operator) => (
                <label className="choice" key={operator.id}>
                  <input type="checkbox" name="operatorIds" value={operator.id} />
                  <span>
                    <strong>{operator.code}</strong>
                    <span className="cell-hint"> — {operator.name}</span>
                  </span>
                </label>
              ))
            )}
            {errorFor("operatorIds").map((message) => (
              <p className="field-error" key={message} role="alert">
                {message}
              </p>
            ))}
          </fieldset>
        </div>

        <div className="form-actions">
          <SubmitButton />
        </div>
      </form>
    </section>
  );
}
