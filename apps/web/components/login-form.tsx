"use client";

import { ApiError } from "@saas/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./auth-provider";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      await api.login(String(data.get("email")), String(data.get("password")));
      await refreshUser();
      const requested = params.get("next");
      router.replace(requested?.startsWith("/dashboard") ? requested : "/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? "The email or password is incorrect."
          : cause instanceof ApiError && cause.status === 429
            ? "Too many attempts. Wait a minute before trying again."
            : "Sign in is unavailable right now. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="authForm"
      onSubmit={submit}
      aria-describedby={error ? "login-error" : undefined}
    >
      {error && (
        <div id="login-error" className="alert alertError" role="alert">
          {error}
        </div>
      )}
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={320} required />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        minLength={12}
        maxLength={128}
        required
      />
      <button className="button buttonPrimary" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
