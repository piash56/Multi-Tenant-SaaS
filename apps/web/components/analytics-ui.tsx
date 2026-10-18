"use client";

import { ApiError } from "@saas/api-client";
import type { AnalyticsMetric, AnalyticsResponse, ModeratorPerformance } from "@saas/shared-types";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./auth-provider";

function formatMetric(metric: AnalyticsMetric) {
  if (metric.status === "unavailable") return "Unavailable";
  if (metric.value === null) return metric.unit === "milliseconds" ? "No sample" : "0";
  if (metric.unit !== "milliseconds") return metric.value.toLocaleString();
  const seconds = Math.round(metric.value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}m ${seconds % 60}s`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const metricCards: Array<[keyof AnalyticsResponse["organization"], string]> = [
  ["repliesAuthored", "Replies authored"],
  ["conversationsResolved", "Conversations resolved"],
  ["currentPendingWorkload", "Current pending workload"],
  ["assistedConversations", "Assisted conversations"],
  ["averageResponseTime", "Average response time"],
  ["resolutionTime", "Resolution time"],
];

export function AnalyticsPage() {
  const { state } = useAuth();
  const membership = state.status === "authenticated" ? state.membership : undefined;
  const [preset, setPreset] = useState("last7days");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ModeratorPerformance>();
  const query = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom" && from && to) {
      params.set("from", from);
      params.set("to", to);
    }
    return params.toString();
  }, [from, preset, to]);

  useEffect(() => {
    if (!membership || (preset === "custom" && (!from || !to))) {
      return;
    }
    let active = true;
    void api
      .getAnalytics(membership.organizationId, query)
      .then((value) => {
        if (active) {
          setData(value);
          setError("");
          setSelected(undefined);
        }
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof ApiError ? reason.message : "Analytics could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, membership, preset, query, to]);

  async function openDetail(id: string) {
    if (!membership) return;
    setError("");
    try {
      setSelected(
        (await api.getModeratorAnalytics(membership.organizationId, id, query)).moderator,
      );
    } catch (reason) {
      setError(
        reason instanceof ApiError ? reason.message : "Moderator detail could not be loaded.",
      );
    }
  }

  if (state.status === "authenticated" && !membership)
    return (
      <div className="stateCard">
        <p className="statusCode">403</p>
        <h1>Access restricted</h1>
        <p>Platform maintenance accounts have no implicit access to business analytics.</p>
      </div>
    );

  return (
    <div className="contentStack">
      <header className="pageHeading">
        <div>
          <p className="eyebrow">Milestone 6</p>
          <h1>Analytics &amp; Leaderboard</h1>
          <p>
            Real activity, authorship, assignment, completion, and response metrics within your
            authorized scope.
          </p>
        </div>
      </header>
      <section className="panel analyticsFilters" aria-label="Analytics date range">
        <label>
          Range
          <select value={preset} onChange={(event) => setPreset(event.target.value)}>
            <option value="today">Today</option>
            <option value="last7days">Last 7 days</option>
            <option value="last30days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label>
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </>
        )}
        {data && (
          <p className="formHint">Timezone: {data.range.timezone}. End date is inclusive.</p>
        )}
      </section>
      {error && (
        <div className="alert alertError" role="alert">
          <strong>Unable to load analytics</strong>
          <p>{error}</p>
        </div>
      )}
      {loading ? (
        <div className="panel adminLoading" aria-busy="true">
          <div className="spinner" />
          <p>Calculating authorized analytics…</p>
        </div>
      ) : (
        data && (
          <>
            <section className="summaryGrid" aria-label="Organization analytics">
              {metricCards.map(([key, label]) => (
                <article className="summaryCard" key={key}>
                  <p>{label}</p>
                  <strong className="metricValue">{formatMetric(data.organization[key])}</strong>
                  {data.organization[key].unit && (
                    <small>{data.organization[key].sampleSize ?? 0} measured interval(s)</small>
                  )}
                </article>
              ))}
            </section>
            <section className="panel">
              <h2>Moderator performance</h2>
              {data.moderators.length === 0 ? (
                <div className="emptyState">
                  <strong>No authorized moderators in this scope</strong>
                  <p>
                    Zero activity is shown as 0 when a moderator is present; this state means no
                    eligible membership is visible.
                  </p>
                </div>
              ) : (
                <div className="tableScroll">
                  <table className="dataTable">
                    <thead>
                      <tr>
                        <th>Moderator</th>
                        <th>Assigned</th>
                        <th>Reassigned in</th>
                        <th>Reassigned away</th>
                        <th>Pending</th>
                        <th>Replies</th>
                        <th>Resolved</th>
                        <th>Reopened</th>
                        <th>Assisted</th>
                        <th>Avg. response</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.moderators.map((item) => (
                        <tr key={item.membershipId}>
                          <td>
                            <strong>{item.displayName}</strong>
                            <small>{item.role.replaceAll("_", " ")}</small>
                          </td>
                          <td>{formatMetric(item.conversationsAssigned)}</td>
                          <td>{formatMetric(item.conversationsReassigned)}</td>
                          <td>{formatMetric(item.conversationsReassignedAway)}</td>
                          <td>{formatMetric(item.currentPendingWorkload)}</td>
                          <td>{formatMetric(item.repliesAuthored)}</td>
                          <td>{formatMetric(item.conversationsResolved)}</td>
                          <td>{formatMetric(item.conversationsReopened)}</td>
                          <td>{formatMetric(item.assistedConversations)}</td>
                          <td>{formatMetric(item.averageResponseTime)}</td>
                          <td>
                            <button
                              className="textButton"
                              onClick={() => void openDetail(item.membershipId)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel">
              <h2>Leaderboard</h2>
              <p className="formHint">
                Separate ranks avoid an unexplained combined score. Ties are deterministic by
                display name, then membership ID.
              </p>
              <div className="tableScroll">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Moderator</th>
                      <th>Reply rank</th>
                      <th>Resolved rank</th>
                      <th>Response-time rank</th>
                      <th>Replies</th>
                      <th>Resolved</th>
                      <th>Average response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((item) => (
                      <tr key={item.membershipId}>
                        <td>
                          <strong>{item.displayName}</strong>
                        </td>
                        <td>#{item.ranks.replies}</td>
                        <td>#{item.ranks.resolved}</td>
                        <td>
                          {item.ranks.responseTime ? `#${item.ranks.responseTime}` : "No sample"}
                        </td>
                        <td>{item.repliesAuthored}</td>
                        <td>{item.conversationsResolved}</td>
                        <td>{formatMetric(item.averageResponseTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {data.teams.length > 0 && (
              <section className="panel">
                <h2>Team performance</h2>
                <div className="tableScroll">
                  <table className="dataTable">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Members</th>
                        <th>Replies</th>
                        <th>Resolved</th>
                        <th>Pending</th>
                        <th>Avg. response</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teams.map((team) => (
                        <tr key={team.id}>
                          <td>
                            <strong>{team.name}</strong>
                          </td>
                          <td>{team.members}</td>
                          <td>{formatMetric(team.metrics.repliesAuthored)}</td>
                          <td>{formatMetric(team.metrics.conversationsResolved)}</td>
                          <td>{formatMetric(team.metrics.currentPendingWorkload)}</td>
                          <td>{formatMetric(team.metrics.averageResponseTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {selected && (
              <section className="panel" aria-live="polite">
                <div className="toolbar">
                  <div>
                    <h2>{selected.displayName}</h2>
                    <p className="formHint">Authorized individual detail</p>
                  </div>
                  <button className="button" onClick={() => setSelected(undefined)}>
                    Close
                  </button>
                </div>
                <dl className="detailList">
                  {metricCards.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{formatMetric(selected[key])}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>First response time</dt>
                    <dd>{formatMetric(selected.firstResponseTime)}</dd>
                  </div>
                  <div>
                    <dt>Conversations assigned</dt>
                    <dd>{formatMetric(selected.conversationsAssigned)}</dd>
                  </div>
                </dl>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
