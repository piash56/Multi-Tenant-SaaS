"use client";

import { roleLabels } from "../../../lib/dashboard";
import { useAuth } from "../../../components/auth-provider";

export default function AccountPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  const { user, membership } = state;
  return (
    <div className="contentStack">
      <header className="pageHeading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile and access</h1>
          <p>Read-only identity details supplied by the authenticated API.</p>
        </div>
      </header>
      <section className="panel">
        <h2>Personal details</h2>
        <dl className="detailList">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Display name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>Platform role</dt>
            <dd>{user.platformRole === "SUPER_ADMIN" ? "Super Admin" : "Standard user"}</dd>
          </div>
          <div>
            <dt>Current organization role</dt>
            <dd>{membership ? roleLabels[membership.role] : "None"}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <h2>Organization memberships</h2>
        {user.memberships.length ? (
          <ul className="membershipList">
            {user.memberships.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.organization.name}</strong>
                  <span>{item.organization.slug}</span>
                </div>
                <span className="roleBadge">{roleLabels[item.role]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="emptyState">
            <strong>No active memberships</strong>
            <p>Super Admin status does not grant implicit access to private tenant resources.</p>
          </div>
        )}
      </section>
    </div>
  );
}
