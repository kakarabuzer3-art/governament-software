"use client";

/**
 * Enable / disable controls for one account (Phase B).
 *
 * Disabling asks for an optional short reason that is stored on the account and
 * shown in the audit trail. The server refuses to disable the acting
 * administrator or the last enabled System Administrator, and revokes the
 * account's sessions when it succeeds — the UI only reports what the server
 * decided.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserDisabledAction } from "@/lib/users/actions";
import { EMPTY_FORM_STATE } from "@/lib/transport/form-types";

export interface UserStatusControlsProps {
  userId: string;
  userName: string;
  disabled: boolean;
  disabledReason?: string | null;
  /** False when the account is the acting administrator (server blocks it). */
  isSelf: boolean;
}

export function UserStatusControls({
  userId,
  userName,
  disabled,
  disabledReason,
  isSelf,
}: UserStatusControlsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextDisabled: boolean) {
    if (nextDisabled) {
      const confirmed = window.confirm(
        `Disable ${userName}?\n\nThey will be signed out immediately and cannot sign in again until re-enabled. The account and its history are kept.`,
      );
      if (!confirmed) return;
    }
    setPending(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("disabled", String(nextDisabled));
    if (nextDisabled && reason.trim()) formData.set("reason", reason.trim());

    try {
      const result = await setUserDisabledAction(EMPTY_FORM_STATE, formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="status-controls">
      {disabled ? (
        <>
          <p className="notice notice--warning" role="status">
            This account is disabled
            {disabledReason ? `: ${disabledReason}` : "."} Its sessions have been
            revoked.
          </p>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => submit(false)}
          >
            {pending ? "Working…" : "Re-enable account"}
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field-label" htmlFor="disable-reason">
              Reason (optional)
            </label>
            <input
              id="disable-reason"
              className="input"
              value={reason}
              maxLength={200}
              placeholder="e.g. employment ended, role under review"
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="field-help">
              Recorded on the account and in the audit trail. Do not enter
              sensitive personal details.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--danger"
            disabled={pending || isSelf}
            onClick={() => submit(true)}
            title={
              isSelf
                ? "You cannot disable your own account"
                : `Disable ${userName}`
            }
          >
            {pending ? "Working…" : "Disable account"}
          </button>
          {isSelf ? (
            <p className="field-help">
              You cannot disable your own account. Ask another administrator.
            </p>
          ) : null}
        </>
      )}

      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
