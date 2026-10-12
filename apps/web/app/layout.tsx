import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: "Unified Inbox SaaS",
  description: "Multi-tenant unified inbox foundation",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <Link className="brand" href="/">
            Unified Inbox
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/status">System status</Link>
          </nav>
        </header>
        <main className="pageShell">{children}</main>
      </body>
    </html>
  );
}
