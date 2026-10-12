# Authentication and role-based access control

## Authentication model

Use first-party email/password authentication initially, with an extensible identity boundary for future OIDC/SSO and MFA. The NestJS API owns credentials and sessions. Passwords are hashed with Argon2id using parameters calibrated and recorded for the deployed environment; plaintext passwords, reset tokens, invitation tokens, refresh tokens, and MFA recovery codes are never stored.

### Browser session

- Short-lived access credential and rotating refresh session.
- Prefer an `HttpOnly`, `Secure`, `SameSite` cookie strategy for browser refresh/session material. If cookies authenticate state-changing requests, use explicit CSRF protection (token/origin checks as designed and tested); CORS is not CSRF protection.
- Do not expose long-lived tokens to browser JavaScript or local storage.

### Mobile session

- OAuth-style access/refresh token behavior over TLS, with refresh material in Expo SecureStore/OS-backed storage, never AsyncStorage.
- Short-lived access token may remain in memory. Rotation/reuse detection and server-side revocation apply equally to web and mobile.
- No client bundle contains API, encryption, Meta, signing, or administrative secrets.

Exact credential transport is finalized and threat-modeled in Milestones 2 and 4. Both clients use the same session service and authorization semantics.

## Login, refresh, and logout

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant D as PostgreSQL
  C->>A: Credentials + client context
  A->>A: Validate, rate limit, verify Argon2id
  A->>D: Create refresh-token family/session (hashed)
  A-->>C: Short access + protected refresh credential
  C->>A: Refresh credential
  A->>D: Atomically rotate; revoke previous token
  A-->>C: New access + refresh
  C->>A: Logout
  A->>D: Revoke session/family
  A-->>C: Clear credential / success
```

- Login responses use generic failure messages and rate limits by account plus network/device signals, without permanent denial-of-service lockouts.
- Refresh-token reuse revokes the token family and records a security event.
- Logout revokes the current session; “logout all devices,” password reset, account suspension, and sensitive privilege changes revoke relevant sessions.
- Expiry, issuer, audience, algorithm, key ID, and signature are validated. Key rotation supports overlap without accepting unspecified algorithms.
- Password reset uses a short-lived, single-use, hashed token; successful reset revokes sessions. Email ownership verification and invitation acceptance are distinct audited flows.

## Authorization model

Permissions are action-oriented and enforced in backend policy checks. Suggested initial keys:

- `organization.read`, `organization.update`, `members.read`, `members.manage`, `invitations.manage`
- `channels.read`, `channels.manage`
- `inbox.read`, `messages.reply`, `comments.reply`, `comments.moderate`
- `assignments.self`, `assignments.manage`, `conversations.resolve`
- `analytics.self`, `analytics.team`, `audit.read`
- platform-only `platform.organizations.manage`, `platform.users.manage`, `platform.audit.read`

Initial role matrix (least-privilege baseline; final endpoint matrix is tested in Milestone 4):

| Capability | Super Admin | Organization Admin | Supervisor | Moderator |
| --- | --- | --- | --- | --- |
| Platform tenant lifecycle | Yes, platform endpoints | No | No | No |
| Organization settings/channels | Audited support policy only | Yes | Read by need | No by default |
| Members/invitations/roles | Platform emergency policy | Yes | Read/team operations as granted | No |
| View tenant inbox | Only explicit audited support access | Yes | Yes | Yes |
| Reply to supported items | Not implicit; requires support policy | Yes | Yes | Yes |
| Assign/reassign any moderator | Not implicit | Yes | Yes | No by default |
| Claim/unassign self | Not implicit | Yes | Yes | Optional `assignments.self` |
| Resolve/reopen | Not implicit | Yes | Yes | Yes if granted |
| Team analytics | Platform aggregate policy | Yes | Yes | Own only |
| Tenant audit log | Explicit audited support | Yes | Optional read | No |

Super Admin does not automatically impersonate tenant members. Any future support-access/impersonation feature requires explicit justification, step-up authentication, reason, bounded duration, visible audit records, and separate approval.

## Authorization procedure

For every protected operation the API checks, in order: authenticated active user; valid non-revoked session; active organization; active membership for that organization; required permission; tenant ownership of every referenced resource; state/capability preconditions; and step-up authentication for sensitive actions when enabled. The actual message/reply actor is always the membership from this context.

Socket connection and room joins perform equivalent checks. Workers use a named service identity and re-resolve tenant/resource relationships. Scheduled/system actions record their service actor rather than inventing a user.

## Future MFA

Design session records with authentication method/reference and `auth_time`/assurance level. Milestone 18 implements maintained TOTP or WebAuthn-compatible MFA, one-use hashed recovery codes, protected enrollment/reset, replay prevention, and rate limits. Privileged/platform accounts should be required first. Schema/API choices before then must not prevent step-up authentication.

## Security events and tests

Audit successful/failed privileged auth changes, session revocations, role changes, invitation lifecycle, password/MFA resets, and Super Admin actions without logging secrets. Required negative tests include missing/expired/malformed credentials, token replay, refresh reuse, disabled user/membership, organization substitution, object ID substitution, role escalation, client-supplied author IDs, socket reuse after removal, and CSRF behavior for browser cookie flows.

