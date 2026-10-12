import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "customer" | "admin";
};

export function AuthPage({
  mode,
  next,
  onComplete,
  onSwitch,
}: {
  mode: "login" | "signup";
  next: string;
  onComplete: (user: AuthUser, csrf: string, next: string) => void;
  onSwitch: (mode: "login" | "signup", next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    setError("");
    setVisible(false);
  }, [mode]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    if (mode === "signup" && !name) {
      setError("Enter your full name to create an account.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { name, email, password } : { email, password },
        ),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error ||
            (mode === "login"
              ? "Unable to sign in. Please try again."
              : "Unable to create your account. Please try again."),
        );
      onComplete(result.user, result.csrf_token, next);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Connection interrupted. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-form-side">
        <div className="auth-form-inner">
          <a className="back-link dark" href="#">
            <ArrowLeft size={17} /> Back to films
          </a>
          <h1 ref={heading} tabIndex={-1}>
            {mode === "login" ? "Welcome back." : "Come on in."}
          </h1>
          <p className="auth-lede">
            {mode === "login"
              ? "Sign in to book tickets and view your bookings."
              : "Create an account to book tickets and view your bookings."}
          </p>
          <form onSubmit={submit} aria-busy={busy}>
            {mode === "signup" && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  disabled={busy}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                disabled={busy}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 8 : undefined}
                  maxLength={128}
                  required
                  disabled={busy}
                  aria-describedby={
                    mode === "signup" ? "password-help" : undefined
                  }
                />
                <button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                  disabled={busy}
                >
                  {visible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
            {mode === "signup" && (
              <p id="password-help" className="field-help">
                At least 8 characters.
              </p>
            )}
            {error && (
              <p className="error-line" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="signal-button auth-submit"
              disabled={busy}
            >
              {busy
                ? "One moment…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}{" "}
              <ArrowRight size={19} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to FRAME?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() =>
                onSwitch(mode === "login" ? "signup" : "login", next)
              }
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="auth-quiet">
            Your details are used only for this sample cinema account.
          </p>
        </div>
      </div>
    </section>
  );
}
