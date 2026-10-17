import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="authPage">
      <section className="authIntro">
        <Link className="wordmark light" href="/">
          Unified Inbox
        </Link>
        <div>
          <p className="eyebrow lightText">Secure team workspace</p>
          <h1>Everything your support team needs, in one focused place.</h1>
          <p>
            Sign in with an account provisioned by your administrator. Credentials are protected
            with server-managed, rotating sessions.
          </p>
        </div>
        <small>Access is limited to authorized users and organizations.</small>
      </section>
      <section className="authPanel">
        <div className="authCard">
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your account</h2>
          <p className="muted">Use your existing Unified Inbox credentials.</p>
          <Suspense fallback={<p role="status">Loading secure sign-in…</p>}>
            <LoginForm />
          </Suspense>
          <p className="privacyNote">
            Your session uses secure cookies. Passwords and tokens are never stored in browser
            storage.
          </p>
        </div>
      </section>
    </main>
  );
}
