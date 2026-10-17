"use client";

import { ApiError } from "@saas/api-client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "./auth-provider";

export function InvitationAcceptance() {
  const token = useSearchParams().get("token") ?? "";
  const { state, refreshUser } = useAuth();
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function existing() {
    setBusy(true);
    try {
      await api.acceptInvitation(token);
      await refreshUser();
      setResult("Invitation accepted. You can now open the dashboard.");
    } catch (error) {
      setResult(error instanceof ApiError ? error.message : "Invitation acceptance failed.");
    } finally {
      setBusy(false);
    }
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api.registerInvitation({
        token,
        email: String(form.get("email")),
        displayName: String(form.get("displayName")),
        password: String(form.get("password")),
      });
      setResult("Account created and invitation accepted. Sign in with your new account.");
    } catch (error) {
      setResult(error instanceof ApiError ? error.message : "Invitation acceptance failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!token) return <div className="alert alertError">This invitation link is incomplete.</div>;
  return (
    <div className="authCard">
      <h2>Accept invitation</h2>
      <p>Invitation tokens are single-use and bound to the invited email address.</p>
      {result && (
        <div className="alert" role="status">
          {result}
        </div>
      )}
      {state.status === "authenticated" ? (
        <button className="button buttonPrimary" disabled={busy} onClick={() => void existing()}>
          {busy ? "Accepting…" : "Accept for signed-in account"}
        </button>
      ) : (
        <form className="authForm" onSubmit={register}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Display name
            <input name="displayName" required minLength={2} />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </label>
          <small>Use at least 12 characters with uppercase, lowercase, number, and symbol.</small>
          <button className="button buttonPrimary" disabled={busy}>
            {busy ? "Creating account…" : "Create account and accept"}
          </button>
        </form>
      )}
    </div>
  );
}
