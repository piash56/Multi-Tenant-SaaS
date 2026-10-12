# Social channel adapters

## Scope

Milestone 1 defines interfaces only. Live Facebook, Instagram, and WhatsApp behavior must use current official Meta APIs and authorized assets in Milestones 11-13. Until then, deterministic mock adapters support development and contract tests.

## Adapter boundary

```ts
interface ChannelAdapter {
  verifyWebhook(request: RawWebhookRequest): Promise<VerifiedWebhook>;
  routeWebhook(event: VerifiedWebhook): Promise<AccountRoute>;
  normalize(event: VerifiedWebhook): Promise<NormalizedEvent[]>;
  sendMessage(command: SendMessageCommand): Promise<ProviderSendReceipt>;
  sendCommentReply(command: SendCommentReplyCommand): Promise<ProviderSendReceipt>;
  fetchMedia(reference: ProviderMediaReference): Promise<BoundedMediaStream>;
  getCapabilities(context: ChannelContext): Promise<ChannelCapabilities>;
  classifyError(error: unknown): ProviderError;
}
```

Not every adapter supports every method. Capability results express text/media/reply/moderation support, size limits, reply windows, templates, status semantics, and current API version. Application code rejects unsupported actions rather than emulating them incorrectly.

Normalized events are versioned discriminated types for inbound DM, message status, comment create/edit/delete, comment reply, account lifecycle, and unsupported/diagnostic events. They include provider/account identifiers, event occurrence and receipt times, dedupe keys, safe actor/content data, and a reference/hash to limited raw evidence.

## Webhook pipeline

1. Terminate TLS at trusted infrastructure while preserving the exact raw request bytes required for signature validation.
2. Enforce method, content type, maximum size, timeout, and endpoint-specific rate limits.
3. Answer provider verification challenges using server-held verification secrets and exact documented rules.
4. Verify signature before trusting payload content; select secrets safely when routing information is untrusted.
5. Persist a `WebhookEvent` with provider delivery/event key or deterministic payload hash under a unique constraint.
6. Acknowledge valid receipt quickly. Invalid signatures return the provider-appropriate failure without enqueuing business work.
7. Enqueue only the internal webhook-event ID. Worker reloads and schema-validates stored data, routes to an active connected account, and normalizes transactionally.
8. Unknown accounts/events are quarantined or safely marked unsupported; they never fall into a default tenant.

## Idempotency, order, and retries

- Prefer provider event/message/comment IDs scoped to the connected account. Where absent, use a documented stable composite key/hash.
- Database uniqueness is the final dedupe gate; queue job IDs are an optimization.
- Consumers are idempotent and transactionally record processing state plus business changes/outbox.
- Do not assume delivery order. Compare provider occurrence/version timestamps and apply channel-specific monotonic transition rules while retaining evidence.
- Retry only classified transient failures (rate limit, timeout, eligible 5xx) with exponential backoff and jitter, honoring provider retry hints. Permanent authorization/policy/input failures do not loop.
- Dead-lettered jobs expose redacted diagnostics and operator retry controls. Replays remain idempotent.
- Exactly-once external delivery cannot generally be guaranteed. Use provider idempotency when available and reconcile ambiguous timeouts before blind resend where APIs permit.

## Outbound restrictions

Adapters enforce current provider rules such as messaging windows, WhatsApp templates/consent, account eligibility, supported attachment formats, comment permissions, and rate limits. Provider acceptance maps to `SENT` only according to documented evidence; `DELIVERED`/`READ` require provider status events where supported. Token expiry/revocation transitions the connected account to a visible action-required state.

## Token and payload security

- OAuth exchanges and long-lived provider tokens occur server-side over TLS.
- Store tokens encrypted with versioned envelope encryption/KMS-backed keys in hosted environments; restrict decryption to API/worker identities that need it.
- Never place tokens in client bundles, URLs, logs, analytics, queue dashboards, or error responses.
- Redact message/customer content and headers from routine logs. Limit raw webhook retention and access.
- Remote media fetches use provider-authenticated URLs where required, destination allowlists/validation, redirect and DNS revalidation, private-address denial, and time/size limits.

## Mock adapter contract

Mocks must simulate successes, permanent/transient errors, rate limits, delayed/out-of-order statuses, duplicate webhooks, token expiry, unsupported capabilities, and ambiguous timeouts. Mock UI is labeled and must never imply a live account is connected. Shared contract tests run against every adapter implementation.

## Platform-specific planning assumptions

- **Messenger:** Facebook app/Page access, Page permissions/tokens, webhook subscriptions, app mode/review, and test Page.
- **Instagram DMs/comments:** eligible professional account linked as Meta currently requires, appropriate messaging/content permissions, subscribed webhooks, and test media/accounts.
- **Facebook comments:** Page/content permissions and webhook subscriptions for supported posts/comments.
- **WhatsApp Cloud API:** Meta business portfolio, app/system-user arrangements as applicable, WABA, phone number ID, verification/test number, templates, consent and messaging-window compliance.

Exact permission names, Graph API versions, review evidence, token lifetimes, restrictions, and pricing are intentionally not frozen here because Meta changes them. Verify current official documentation at implementation time and record the version/date.

