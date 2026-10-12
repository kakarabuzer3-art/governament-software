"use client";

/**
 * Archive (soft-deactivate) control.
 *
 * Uses the module's server action, which re-checks the permission, the
 * operator scope and the record's existence on the server. Records are never
 * deleted, so this is safe to offer inline in a list.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/transport/form-types";

export interface ArchiveButtonProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label?: string;
  /** Human description of what is being archived, for the confirm dialog. */
  what: string;
  disabled?: boolean;
}

export function ArchiveButton({
  action,
  id,
  label = "Archive",
  what,
  disabled = false,
}: ArchiveButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="inline-form"
      action={async (formData: FormData) => {
        const confirmed = window.confirm(
          `Archive ${what}?\n\nThe record is kept for history and can no longer be selected for new work. Nothing is deleted.`,
        );
        if (!confirmed) return;
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
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="btn btn--sm btn--ghost"
        disabled={disabled || pending}
      >
        {pending ? "Archiving…" : label}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
