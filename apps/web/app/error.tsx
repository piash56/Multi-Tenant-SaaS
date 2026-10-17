"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="centerState">
      <section className="stateCard" role="alert">
        <h1>Something went wrong</h1>
        <p>The page could not be rendered. No business data was changed.</p>
        <button className="button buttonPrimary" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
