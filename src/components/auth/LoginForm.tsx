"use client";

/**
 * Login form — glassmorphism, accessible, with password visibility toggle,
 * inline validation, loading state and safe error messaging.
 *
 * Error messages are intentionally generic (we never reveal whether the email
 * or the password was wrong) to avoid account enumeration. All real
 * verification happens server-side via Better Auth.
 */
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/ui/icons";
import { safeNextTarget } from "@/lib/safe-redirect";

/**
 * One generic credential failure message for every rejected sign-in.
 *
 * Phase 2 defect D: we never surface the library's raw message, because a
 * differing message per cause ("no such account" vs "wrong password" vs
 * "account disabled") is an account-enumeration oracle. The same text is shown
 * whether the email is unknown, the password is wrong, or the account is
 * otherwise ineligible.
 */
const GENERIC_SIGN_IN_ERROR =
  "Sign-in failed. Check your email and password, then try again.";

/** Shown only when the request never reached the server. */
const NETWORK_SIGN_IN_ERROR =
  "Unable to reach the server. Check your connection and try again.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextTarget = safeNextTarget(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Client-side validation for fast feedback; the server re-validates.
    if (!email.trim()) {
      setFieldError("Enter your email address.");
      return;
    }
    if (!password) {
      setFieldError("Enter your password.");
      return;
    }
    setFieldError(null);

    setPending(true);
    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (error) {
        // Generic on purpose: never disclose whether the account exists or
        // which credential was wrong (no account-enumeration oracle).
        setFormError(GENERIC_SIGN_IN_ERROR);
        return;
      }

      // Full navigation is required: the shell loads identity once on mount,
      // and a client-side refresh would leave the top bar showing the stale
      // "Not signed in" state. A fresh page load re-verifies identity
      // server-side against the newly issued session.
      window.location.href = nextTarget;
    } catch {
      // The request never completed — distinct from a rejected credential.
      setFormError(NETWORK_SIGN_IN_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="username"
          placeholder="you@example.test"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldError && !email.trim())}
          required
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <div className="password-field">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldError && !password)}
            required
          />
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? "Hide password" : "Show password"
            }
            aria-pressed={showPassword}
          >
            <Icon name={showPassword ? "close" : "search"} size={16} />
          </button>
        </div>
      </div>

      {fieldError ? (
        <p className="login-error" role="alert">
          <Icon name="alertTriangle" size={15} />
          <span>{fieldError}</span>
        </p>
      ) : null}

      {formError ? (
        <p className="login-error" role="alert">
          <Icon name="alertTriangle" size={15} />
          <span>{formError}</span>
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn--primary login-submit"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="login-help">
        Access is restricted. Accounts are created by an administrator. If you
        cannot sign in, contact your system administrator.
      </p>
    </form>
  );
}
