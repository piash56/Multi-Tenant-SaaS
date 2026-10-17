"use client";

import { availableActions, roleLabels } from "../../lib/dashboard";
import { useAuth } from "../../components/auth-provider";

export default function DashboardPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  const { user, membership } = state;
  const platformAdmin = user.platformRole === "SUPER_ADMIN";
  const role = platformAdmin
    ? "Super Admin"
    : membership
      ? roleLabels[membership.role]
      : "No active role";
  const actions = availableActions(membership?.role, platformAdmin);
  return (
    <div className="contentStack">
      <header className="pageHeading">
        <div>
          <p className="eyebrow">Dashboard overview</p>
          <h1>Welcome back, {membership?.displayName ?? user.displayName}</h1>
          <p>Here’s the authorized context for your current session.</p>
        </div>
        <span className="statusPill">
          <span />
          Session active
        </span>
      </header>
      {!platformAdmin && !membership && (
        <div className="alert alertWarning" role="status">
          <strong>No active organization</strong>
          <p>
            Your account is authenticated but has no active organization membership. Ask an
            administrator to restore access.
          </p>
        </div>
      )}
      <section className="summaryGrid" aria-label="Account summary">
        <article className="summaryCard">
          <span className="cardIcon" aria-hidden="true">
            ID
          </span>
          <p>Signed in as</p>
          <strong>{user.email}</strong>
          <small>Identity verified by the API</small>
        </article>
        <article className="summaryCard">
          <span className="cardIcon" aria-hidden="true">
            ORG
          </span>
          <p>Current context</p>
          <strong>
            {membership?.organization.name ??
              (platformAdmin ? "Platform maintenance" : "No business workspace")}
          </strong>
          <small>{membership?.organization.slug ?? "No tenant data selected"}</small>
        </article>
        <article className="summaryCard">
          <span className="cardIcon" aria-hidden="true">
            ROLE
          </span>
          <p>Authorized role</p>
          <strong>{role}</strong>
          <small>
            {platformAdmin ? "Platform permissions only" : "Organization-scoped permissions"}
          </small>
        </article>
      </section>
      <section className="panel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Available to you</p>
            <h2>Actions for your role</h2>
          </div>
          <span className="roleBadge">{role}</span>
        </div>
        {actions.length ? (
          <ul className="checkList">
            {actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        ) : (
          <div className="emptyState">
            <strong>No tenant actions available</strong>
            <p>Select an active organization membership to see tenant capabilities.</p>
          </div>
        )}
        <div className="phaseBanner">
          <strong>Business administration is ready</strong>
          <p>
            Owners can manage moderators, teams, settings, social account metadata, and activity.
            Analytics and inbox functionality remain clearly marked future milestones.
          </p>
        </div>
      </section>
    </div>
  );
}
