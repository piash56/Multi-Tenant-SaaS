import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Milestone 2 foundation</p>
      <h1>A secure base for every customer conversation.</h1>
      <p className="lede">
        The web, API, worker, and Android foundations share typed contracts while PostgreSQL remains
        the future source of truth.
      </p>
      <div className="actions">
        <Link className="primaryAction" href="/status">
          Check API status
        </Link>
        <span className="muted">Business features begin in later approved milestones.</span>
      </div>
    </section>
  );
}
