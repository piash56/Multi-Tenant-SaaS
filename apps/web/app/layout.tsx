import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "../components/auth-provider";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Unified Inbox", template: "%s · Unified Inbox" },
  description: "Secure multi-tenant customer conversation workspace",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
