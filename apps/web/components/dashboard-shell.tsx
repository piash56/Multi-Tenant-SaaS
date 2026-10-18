"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { navigationFor, protectedLoginPath, roleLabels } from "../lib/dashboard";
import { useAuth } from "./auth-provider";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { state, selectOrganization, logout, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useEffect(() => {
    if (state.status === "guest") router.replace(protectedLoginPath(pathname));
  }, [pathname, router, state.status]);

  if (state.status === "loading" || state.status === "guest")
    return (
      <main className="centerState" aria-busy="true">
        <div className="spinner" />
        <p role="status">Verifying your secure session…</p>
      </main>
    );
  if (state.status === "error")
    return (
      <main className="centerState">
        <div className="stateCard" role="alert">
          <h1>We couldn’t load your account</h1>
          <p>{state.message}</p>
          <button className="button buttonPrimary" onClick={() => void refreshUser()}>
            Try again
          </button>
        </div>
      </main>
    );

  const { user, membership } = state;
  const displayName = membership?.displayName || user.displayName;
  const role =
    user.platformRole === "SUPER_ADMIN"
      ? "Super Admin"
      : membership
        ? roleLabels[membership.role]
        : "No active organization role";

  return (
    <div className="dashboardFrame">
      <a className="skipLink" href="#main-content">
        Skip to main content
      </a>
      <aside
        className={`sidebar ${menuOpen ? "sidebarOpen" : ""}`}
        aria-label="Dashboard navigation"
      >
        <div className="brandBlock">
          <span className="brandMark">U</span>
          <div>
            <strong>Unified Inbox</strong>
            <span>Business workspace</span>
          </div>
        </div>
        <nav className="sideNav">
          {navigationFor(user, membership).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          ))}
        </nav>
        <div className="phaseNote">
          <strong>Milestone 6</strong>
          <span>Analytics &amp; leaderboard</span>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="sidebarBackdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="dashboardColumn">
        <header className="dashboardHeader">
          <button
            className="iconButton mobileMenu"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <div className="organizationControl">
            <label htmlFor="organization">Business workspace</label>
            {user.memberships.length > 0 ? (
              <select
                id="organization"
                value={membership?.organizationId}
                onChange={(event) => selectOrganization(event.target.value)}
              >
                {user.memberships.map((item) => (
                  <option key={item.id} value={item.organizationId}>
                    {item.organization.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong>Maintenance account</strong>
            )}
          </div>
          <details className="accountMenu">
            <summary>
              <span className="avatar" aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="accountText">
                <strong>{displayName}</strong>
                <small>{role}</small>
              </span>
            </summary>
            <div className="accountPopover">
              <p>{user.email}</p>
              <Link href="/dashboard/account">Account details</Link>
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  setLogoutError(false);
                  try {
                    await logout();
                  } catch {
                    setLogoutError(true);
                  } finally {
                    setLoggingOut(false);
                  }
                }}
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </details>
        </header>
        <main id="main-content" className="dashboardMain">
          {logoutError && (
            <div className="alert alertError" role="alert">
              Sign out failed. Your session is still active; check your connection and try again.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
