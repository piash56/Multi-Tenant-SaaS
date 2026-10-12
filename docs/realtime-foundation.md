# Realtime foundation

Milestone 2 exposes a Socket.IO namespace at `/realtime`. It emits only `system:connected` with a
server timestamp. There are no business subscriptions, tenant rooms, client mutation events, or
sensitive payloads.

Event names use `domain:past-tense-action`, for example `message:created` and
`assignment:changed`. System lifecycle events use the `system:` prefix. Payloads will receive a
versioned envelope in Milestone 9.

Tenant rooms are intentionally not implemented. Later room joins must authenticate the socket,
reload the active membership, authorize the resource on the server, generate room names on the
server, and recover missed events through REST cursor synchronization. A client-supplied room name
must never be trusted.
