"use client";

import { ApiClient } from "@saas/api-client";
import type { ReadinessHealth } from "@saas/shared-types";
import { useEffect, useMemo, useState } from "react";

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; health: ReadinessHealth }
  | { kind: "error"; message: string };

export default function StatusPage() {
  const client = useMemo(
    () => new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001" }),
    [],
  );
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    client
      .getReadiness()
      .then((health) => active && setState({ kind: "ready", health }))
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [client]);

  return (
    <section className="statusCard">
      <p className="eyebrow">Foundation diagnostics</p>
      <h1>Application status</h1>
      {state.kind === "loading" && <p role="status">Checking the API and local services…</p>}
      {state.kind === "error" && (
        <div className="errorPanel" role="alert">
          <strong>API unavailable</strong>
          <p>{state.message}</p>
          <p>Start PostgreSQL, Redis, and the API, then refresh this page.</p>
        </div>
      )}
      {state.kind === "ready" && (
        <dl className="healthGrid">
          <div>
            <dt>API</dt>
            <dd>{state.health.status}</dd>
          </div>
          <div>
            <dt>PostgreSQL</dt>
            <dd>{state.health.dependencies.postgres}</dd>
          </div>
          <div>
            <dt>Redis</dt>
            <dd>{state.health.dependencies.redis}</dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{new Date(state.health.timestamp).toLocaleString()}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
