import Link from "next/link";
import { Suspense } from "react";
import { InvitationAcceptance } from "../../../components/invitation-acceptance";

export default function Page() {
  return (
    <main className="authPage">
      <section className="authIntro">
        <div>
          <p className="eyebrow">Secure onboarding</p>
          <h1>Join your organization.</h1>
          <p>This invitation grants only the organization role selected by its administrator.</p>
        </div>
        <small>
          <Link href="/login">Already have another account? Sign in</Link>
        </small>
      </section>
      <section className="authPanel">
        <Suspense fallback={<div className="spinner" />}>
          <InvitationAcceptance />
        </Suspense>
      </section>
    </main>
  );
}
