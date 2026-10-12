"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="errorPanel" role="alert">
      <h1>Something went wrong</h1>
      <p>The page could not be rendered. No business data was changed.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
