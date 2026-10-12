"use client";

/**
 * Top-bar identity panel for the application shell.
 *
 * Fetches the server-verified /api/me identity once on mount and renders the
 * signed-in user (avatar, name, role) plus a sign-out button. If identity is
 * still being resolved it shows a non-blocking hint; if no user is returned it
 * shows "Not signed in".
 *
 * Phase 2 defect A: the response shape is the shared, typed `MeResponse`
 * contract (`{ user: ... }`) from `src/lib/me.ts`. The client guards the shape
 * at runtime too, so a future contract break degrades to "Not signed in"
 * instead of throwing inside the effect.
 *
 * It holds ONLY a display snapshot (id/name/email/roles). Real permission
 * checks are enforced per-route on the server inside the protected pages and
 * route handlers; the browser never decides whether an action is allowed.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { MeResponse } from "@/lib/me";
import { describeRoles, initialsOf } from "./user-identity";

export function UserTopBar() {
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/me", { headers: { accept: "application/json" } })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!active) return;
        // Runtime shape guard: only accept the documented contract.
        if (
          data &&
          typeof data === "object" &&
          "user" in data &&
          (data as { user: unknown }).user &&
          typeof (data as { user: { id?: unknown } }).user.id === "string"
        ) {
          setMe((data as MeResponse).user);
        } else {
          setMe(null);
        }
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      // Navigating regardless means a failed sign-out call can never trap the
      // user in the shell. The protected page guard re-verifies the session on
      // the next request, so a still-valid session simply lands back on "/".
      router.push("/login");
      router.refresh();
      setSigningOut(false);
    }
  }, [router]);

  if (!me) {
    return (
      <span className="user-meta">
        <span className="user-role">Not signed in</span>
      </span>
    );
  }

  return (
    <div className="topbar-user">
      <span className="user-avatar" aria-hidden="true">
        {initialsOf(me.name)}
      </span>
      <span className="user-meta">
        <span className="user-name">{me.name}</span>
        <span className="user-role">{describeRoles(me.roles)}</span>
      </span>
      <button
        type="button"
        className="btn btn--sm"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? "Signing out\u2026" : "Sign out"}
      </button>
    </div>
  );
}
