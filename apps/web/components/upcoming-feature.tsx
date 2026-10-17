import Link from "next/link";

export function UpcomingFeature({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <div className="contentStack">
      <header className="pageHeading">
        <div>
          <p className="eyebrow">Upcoming feature</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <section className="panel emptyState">
        <strong>Not available yet</strong>
        <p>
          This feature is planned for {milestone}. No sample records or simulated results are shown.
        </p>
        <Link className="button" href="/dashboard">
          Return to dashboard
        </Link>
      </section>
    </div>
  );
}
