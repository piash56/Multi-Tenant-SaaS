import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <h1>Page not found</h1>
      <Link href="/">Return home</Link>
    </section>
  );
}
