import Link from "next/link";

export default function HomePage() {
  return (
    <main className="marketingShell">
      <nav className="marketingNav">
        <Link className="wordmark" href="/">
          Unified Inbox
        </Link>
        <Link className="button buttonSecondary" href="/login">
          Sign in
        </Link>
      </nav>
      <section className="hero">
        <p className="eyebrow">One workspace. Every customer conversation.</p>
        <h1>Support teams move faster when context stays together.</h1>
        <p className="lede">
          A secure multi-tenant workspace for managing customer conversations across supported
          social channels.
        </p>
        <div className="actions">
          <Link className="button buttonPrimary" href="/login">
            Open your workspace
          </Link>
          <Link className="textLink" href="/status">
            View system status
          </Link>
        </div>
      </section>
    </main>
  );
}
