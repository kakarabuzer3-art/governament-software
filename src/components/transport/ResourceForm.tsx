"use client";

/**
 * Declarative, accessible glass form used by every transport module.
 *
 * All validation and all persistence happen server-side in the action; this
 * component only renders fields and surfaces the returned `FormState`. It is
 * submitted through `useActionState`, which already prevents double submits
 * (the submit button is disabled while the action is pending).
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FieldSpec, FormAction, FormState } from "@/lib/transport/form-types";

export interface ResourceFormProps {
  action: FormAction;
  fields: FieldSpec[];
  /** Existing values when editing; omitted when creating. */
  initial?: Record<string, string>;
  submitLabel: string;
  title: string;
  description?: string;
  /** Extra hidden fields (e.g. the record id for updates). */
  hidden?: Record<string, string>;
  /** Link shown next to submit (e.g. "Cancel edit"). */
  cancelHref?: string;
  cancelLabel?: string;
  /** Change this when switching between records so the form re-mounts. */
  formKey?: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function ResourceForm({
  action,
  fields,
  initial = {},
  submitLabel,
  title,
  description,
  hidden = {},
  cancelHref,
  cancelLabel = "Cancel",
  formKey,
}: ResourceFormProps) {
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    { ok: false, message: "", fieldErrors: {} },
  );

  return (
    <section className="panel glass" aria-labelledby={`form-${title.replace(/\W+/g, "-")}`}>
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id={`form-${title.replace(/\W+/g, "-")}`}>
            {title}
          </h3>
          {description ? <p className="panel-subtitle">{description}</p> : null}
        </div>
      </div>

      <form
        key={formKey}
        action={formAction}
        className="resource-form"
        noValidate
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        {state.message && !state.ok ? (
          <p className="login-error" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.message && state.ok ? (
          <p className="form-success" role="status">
            {state.message}
          </p>
        ) : null}

        <div className="form-grid">
          {fields.map((field) => {
            const errors = state.fieldErrors[field.name] ?? [];
            const errorId = `${field.name}-error`;
            const describedBy = [
              field.help ? `${field.name}-help` : null,
              errors.length ? errorId : null,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={field.name}
                className={`field${field.wide ? " field--wide" : ""}`}
              >
                <label className="field-label" htmlFor={field.name}>
                  {field.label}
                  {field.required ? (
                    <span aria-hidden="true"> *</span>
                  ) : (
                    <span className="field-optional"> (optional)</span>
                  )}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    className="input"
                    rows={3}
                    placeholder={field.placeholder}
                    required={field.required}
                    aria-invalid={errors.length > 0}
                    aria-describedby={describedBy || undefined}
                    defaultValue={initial[field.name] ?? ""}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.name}
                    name={field.name}
                    className="input"
                    required={field.required}
                    aria-invalid={errors.length > 0}
                    aria-describedby={describedBy || undefined}
                    defaultValue={initial[field.name] ?? ""}
                  >
                    {!field.required ? <option value="">— None —</option> : null}
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    className="input"
                    placeholder={field.placeholder}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    aria-invalid={errors.length > 0}
                    aria-describedby={describedBy || undefined}
                    defaultValue={initial[field.name] ?? ""}
                  />
                )}

                {field.help ? (
                  <p className="field-help" id={`${field.name}-help`}>
                    {field.help}
                  </p>
                ) : null}
                {errors.map((message) => (
                  <p className="field-error" id={errorId} key={message} role="alert">
                    {message}
                  </p>
                ))}
              </div>
            );
          })}
        </div>

        <div className="form-actions">
          <SubmitButton label={submitLabel} />
          {cancelHref ? (
            <a className="btn" href={cancelHref}>
              {cancelLabel}
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
