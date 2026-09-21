"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";

import { useAuth } from "./auth-provider";
import { FormErrors } from "./form-errors";

export function RegisterForm() {
  const router = useRouter();
  const { state, register } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (state.status === "authenticated") {
      router.replace("/summary");
    }
  }, [router, state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setFields({});
    const form = new FormData(event.currentTarget);
    try {
      await register({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        password_confirmation: String(form.get("password_confirmation") ?? ""),
      });
      router.push("/login?registered=1");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFields(error.fields);
      } else {
        setMessage("Unable to create the account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card">
      <h1>Create account</h1>
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
          autoComplete="new-password"
          aria-describedby={fields.password ? "password-error" : undefined}
          required
        />
        <label htmlFor="password_confirmation">Confirm password</label>
        <input
          id="password_confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          aria-describedby={
            fields.password_confirmation ? "password_confirmation-error" : undefined
          }
          required
        />
        <button disabled={submitting || state.status === "loading"} type="submit">
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p>
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}
