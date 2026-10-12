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

/** Only allow relative, same-site redirects after login (prevents open redirect). */
function safeNextTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/"; // protocol-relative -> external
  return raw;
}

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
    const { error } = await authClient.signIn.email(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          // Full navigation is required: the shell loads identity once on
          // mount, and a client-side refresh would leave the top bar showing
          // the stale "Not signed in" state. A fresh page load re-verifies
          // identity server-side against the newly issued session.
          window.location.href = nextTarget;
        },
        onError: (ctx) => {
          // Generic message — do not disclose which field was wrong.
          setFormError(
            ctx.error.message?.trim() ||
              "Sign-in failed. Check your details and try again.",
          );
        },
      },
    );
    setPending(false);
    if (error) {
      setFormError(
        error.message?.trim() ||
          "Sign-in failed. Check your details and try again.",
      );
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
