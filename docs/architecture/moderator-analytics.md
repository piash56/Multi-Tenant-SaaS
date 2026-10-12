# Moderator assignment and analytics

## Separate facts

The model never conflates these concepts:

1. **Current assignment:** who is primarily responsible now (one active membership or unassigned).
2. **Assignment history:** immutable transitions between assignees.
3. **Authorship:** authenticated membership that actually created a reply.
4. **Assistance:** a non-assigned moderator authored at least one eligible reply during a work episode.
5. **Completion credit:** one auditable recipient for a qualifying resolution event under the policy below.

Replying does not assign or reassign a conversation/comment. The client cannot provide the actual author. The server snapshots the assignee in effect at send time for later analysis without rewriting history.

## Assignment rules

- `current_assignee_membership_id` is nullable; null means explicitly unassigned.
- Assignment targets must be active eligible memberships in the same organization.
- Authorized self-claim and manager reassign operations use a row lock/version check.
- Each mutation updates the projection and appends exactly one event containing prior assignee, new assignee, authenticated actor/service actor, reason/source, request ID, and time.
- History is immutable. Corrections are compensating events, never edits.

## Completion-credit policy (version 1 proposal)

Define a **work episode** as the interval beginning when an item becomes open (created or reopened) and ending at its next qualifying resolution.

For each qualifying resolution event:

1. If an active primary assignee exists at the committed resolution time, that membership receives the single completion credit.
2. If the item is unassigned, the authenticated resolver receives credit only if they authored at least one eligible human outbound reply during the current episode.
3. Otherwise the resolution is recorded with no moderator completion credit (`UNATTRIBUTED`). It is never silently credited to a manager, automation, or prior assignee.
4. Automated/provider closure has no individual credit unless a later approved policy explicitly maps it.
5. A reopen begins a new episode. A later resolution can earn a new completion credit; reports show both gross completions and reopened outcomes so repeated closure is not hidden.
6. Credit is stored on the immutable resolution event with `policy_version=1`; later policy changes do not rewrite historical results.

This favors clear primary ownership while still recording all reply authors and assistants. Approval of this policy is an unresolved product decision before Milestone 6 implementation.

## Metrics and definitions

| Metric | Definition |
| --- | --- |
| Current assigned workload | Open items whose current assignee is the membership at query time |
| Assignments received | Assignment events where `to` is membership during interval |
| Reassignments away | Events where `from` is membership and `to` differs during interval |
| Authored replies | Eligible human outbound replies by authenticated membership, counted once by message/reply ID |
| Assisted conversations | Distinct work episodes where member authored an eligible reply while another member was primary assignee |
| Completion credits | Qualifying resolution events whose stored credit recipient is member |
| Resolutions performed | Resolution events whose actor is member, independent of credit |
| Reopened outcomes | Credited resolution episodes later reopened within the report's defined window |
| First response time | First eligible human outbound reply minus first eligible inbound needing response in an episode |
| Pending workload | Current assigned workload, optionally aged into documented buckets |

Bot/system messages, failed outbound attempts, internal notes, provider echoes, and duplicate/retried events are excluded from human authored-reply counts. `SENT` versus accepted-for-queue inclusion must be explicitly chosen in Milestone 6; recommended authored count uses successfully persisted human intent and reports delivery failures separately, while response-time SLA may require provider acceptance.

## Time and aggregation

Canonical event timestamps are UTC. Reporting uses an organization timezone captured for the report; date range boundaries are converted once to UTC. Historical daily aggregates record metric version and timezone context and are rebuildable from immutable facts. Late provider events and corrections trigger bounded recomputation. Never increment leaderboards directly from socket events or job attempts.

Use one SQL query/transactional fact pipeline as the metric definition source. Daily projections improve performance but must reconcile periodically to source events. Unique source-event keys and resolution-event IDs prevent double counting.

## Leaderboard presentation

Do not collapse performance to one opaque score initially. Display separately: completion credit, authored replies, assisted episodes, current workload, response-time sample count/percentiles, delivery failures, and reopen rate. Always show date range, timezone, inclusion rules, and minimum sample cautions. Restrict team analytics to authorized roles; moderators see their own details by default.

## Required scenario tests

- Assignee replies and resolves: one authorship and one completion credit.
- Non-assignee replies, assignee resolves: assistant authorship/assistance; assignee gets completion.
- Non-assignee replies and resolves while another assignee remains: resolver is author/actor; assignee gets completion.
- Unassigned author resolves: author gets completion under rule 2.
- Unassigned manager resolves with no reply: unattributed completion.
- Reassign A to B after A replied, then resolve: A authorship/assistance; B completion.
- Resolve, reopen, resolve: two versioned episodes and no duplicate within either episode.
- Duplicate webhook/job/request: one fact and one credit.
- Membership deactivated after historical work: history remains attributable to immutable snapshot.

