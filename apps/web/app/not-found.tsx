import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centerState">
      <section className="stateCard">
        <p className="statusCode">404</p>
        <h1>That page isn’t here</h1>
        <p>The address may be incorrect, or the page may have moved.</p>
        <div className="actions">
          <Link className="button buttonPrimary" href="/dashboard">
            Go to dashboard
          </Link>
          <Link className="button buttonSecondary" href="/">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
