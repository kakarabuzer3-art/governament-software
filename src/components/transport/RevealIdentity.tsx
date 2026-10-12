"use client";

/**
 * Authorised reveal of a passenger's full identity values.
 *
 * The plaintext is fetched on demand from a server action that re-checks the
 * MANIFEST_MANAGE permission and the operator scope, and writes an audit event
 * every time. Values are held in component state only — they are never part of
 * the server-rendered HTML and are gone as soon as the page is reloaded.
 */
import { useState, useTransition } from "react";
import { revealPassengerAction, type RevealResult } from "@/lib/transport/actions";

export interface RevealIdentityProps {
  passengerId: string;
  /** Rendered only for users allowed to reveal. */
  disabled?: boolean;
}

export function RevealIdentity({ passengerId, disabled }: RevealIdentityProps) {
  const [data, setData] = useState<RevealResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (data) {
    return (
      <dl className="detail-grid reveal-grid">
        <div>
          <dt>Identity document</dt>
          <dd className="masked-value">
            {data.identityType}: {data.identityNumber}
          </dd>
        </div>
        <div>
          <dt>Mobile number</dt>
          <dd className="masked-value">{data.mobileNumber}</dd>
        </div>
        <div>
          <dt>Permanent address</dt>
          <dd>{data.permanentAddress}</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd className="cell-hint">
            This reveal was recorded in the audit trail.
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <span className="inline-form">
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        disabled={disabled || pending}
        onClick={() => {
          startTransition(async () => {
            const result = await revealPassengerAction(passengerId);
            if (result.ok && result.data) setData(result.data);
            else setError(result.message);
          });
        }}
      >
        {pending ? "Revealing…" : "Reveal identity"}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
