"use client";

/**
 * Generic confirm-then-run action button.
 *
 * Used for reversible administrative transitions (withdrawing a manifest
 * entry, restoring it). The server action it calls still re-checks the
 * permission and the operator scope.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/transport/form-types";

export interface ConfirmActionButtonProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Hidden fields submitted with the action. */
  fields: Record<string, string>;
  label: string;
  confirmText: string;
  className?: string;
}

export function ConfirmActionButton({
  action,
  fields,
  label,
  confirmText,
  className = "btn btn--sm btn--ghost",
}: ConfirmActionButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="inline-form"
      action={async (formData: FormData) => {
        if (!window.confirm(confirmText)) return;
        setPending(true);
        setError(null);
        try {
          const result = await action(
            { ok: false, message: "", fieldErrors: {} },
            formData,
          );
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {pending ? "Working…" : label}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
