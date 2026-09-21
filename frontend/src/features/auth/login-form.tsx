"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";

import { useAuth } from "./auth-provider";
import { FormErrors } from "./form-errors";

export function LoginForm({
  nextPath,
  registrationComplete,
  logoutIncomplete,
}: {
  nextPath: string;
  registrationComplete: boolean;
  logoutIncomplete: boolean;
}) {
  const router = useRouter();
  const { state, login, retryBootstrap } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (state.status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setFields({});
    const form = new FormData(event.currentTarget);
    try {
      await login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFields(error.fields);
      } else {
        setMessage("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card">
      <h1>Sign in</h1>
      {registrationComplete ? (
        <p className="success-message" role="status">
          Account created. Sign in to continue.
        </p>
      ) : null}
      {logoutIncomplete ? (
        <p className="form-error" role="alert">
          The local session was cleared, but the server could not be reached. Retry signing out
          after reconnecting if this browser restores the session.
        </p>
      ) : null}
      {state.status === "error" ? (
        <div className="form-error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => void retryBootstrap()}>
            Retry session check
          </button>
        </div>
      ) : null}
      <FormErrors message={message} fields={fields} />
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={fields.email ? "email-error" : undefined}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={fields.password ? "password-error" : undefined}
          required
        />
        <button disabled={submitting || state.status === "loading"} type="submit">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p>
        Need an account? <Link href="/register">Register</Link>
      </p>
    </section>
  );
}
