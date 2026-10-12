
"use client";

/**
 * Top-bar identity panel for the application shell.
 *
 * Fetches the server-verified /api/me identity once on mount and renders the
 * signed-in user (avatar, name, role) plus a sign-out button. If identity is
 * still being resolved it shows a non-blocking hint; if no user is returned it
 * shows "Not signed in".
 *
 * It holds ONLY a display snapshot (id/name/email/roles). Real permission
 * checks are enforced per-route on the server inside the protected pages and
 * route handlers; the browser never decides whether an action is allowed.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface Me {
  id: string;
  name: string;
  email: string;
  roles: readonly string[];
}

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  DEPARTMENT_OFFICER: "Department Officer",
  OPERATOR_STAFF: "Operator Staff",
  AUDITOR: "Read-Only Auditor",
};

export function UserTopBar() {
  const [me, setMe] = useState<Me | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ user: Me | null }>;
      })
      .then((data) => {
        if (active && data?.user) setMe(data.user);
        else if (active) setMe(null);
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
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
        onError: () => {
          router.push("/login");
        },
      },
    });
    setSigningOut(false);
  }, [router]);

  if (!me) {
    return (
      <span className="user-meta">
        <span className="user-role">Not signed in</span>
      </span>
    );
  }

  const roleLabel = me.roles
    .map((role) => ROLE_LABELS[role] ?? role)
    .join(", ");

  return (
    <div className="topbar-user">
      <span className="user-avatar" aria-hidden="true">
        {me.name
          .trim()
          .split(/\s+/)
          .map((part) => part.charAt(0))
          .slice(0, 2)
          .join("")
          .toUpperCase() || "U"}
      </span>
      <span className="user-meta">
        <span className="user-name">{me.name}</span>
        <span className="user-role">{roleLabel || "Authenticated"}</span>
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
