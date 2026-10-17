import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="centerState">
      <section className="stateCard">
        <p className="statusCode">403</p>
        <h1>Access not permitted</h1>
        <p>Your account is signed in, but it does not have permission to view this resource.</p>
        <Link className="button buttonPrimary" href="/dashboard">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
