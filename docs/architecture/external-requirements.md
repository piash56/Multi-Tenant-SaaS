# External requirements

## Required later, not for Milestone 1

| Area | Account/assets/approval | Needed by | Notes |
| --- | --- | --- | --- |
| Meta development | Meta developer account, app, business portfolio, appropriate business verification | 11-13 | App mode/review and data-use obligations may affect schedule |
| Facebook Messenger | Eligible test/production Page, Page admin access, current messaging permissions, Page token, webhook subscriptions | 11 | Verify exact current permission names and token lifecycle then |
| Instagram | Eligible professional account and required Facebook linkage, test media/users, messaging/comment permissions | 12 | Eligibility and API capabilities vary; use official docs/assets |
| Facebook/Instagram comments | Owned Page/media, content/comment permissions and subscribed webhook fields | 12 | Public reply/moderation support must be capability-driven |
| WhatsApp Cloud API | WABA/business portfolio, phone number ID, verified/test phone, access mechanism, templates and consent records | 13 | Messaging windows, template review, quality/rate limits apply |
| Public webhooks | Stable HTTPS domains, TLS, DNS, provider verification secrets | 11-13/19 | Tunnel may be used only for controlled development |
| Email | Transactional email provider/domain authentication | 4-5 | Invitation, verification, reset; select before implementing live delivery |
| Object storage/scanning | Private object storage, encryption keys, optional malware scanner | 7/19 | Local mock/emulator may precede hosted selection |
| Push/mobile | Expo/EAS and/or Firebase project, FCM credentials, Android package IDs | 17 | Distinct environment projects; protect credentials |
| Android release | Play Console, signing/upload keys, privacy/data safety content, test device | 17/19 | Human approval required for release/publication |
| Hosting | Web/API/worker hosting with WebSockets and persistent workers; managed PostgreSQL/Redis/storage | 19 | Separate staging/production, network controls, backups |
| Observability | Logging/metrics/tracing/error and alerting provider(s) | 9/19 | Select with privacy/redaction and retention constraints |
| Secret/key management | Hosted secret manager and KMS/envelope-encryption capability | 19 (design earlier) | Needed before real long-lived platform tokens |
| Billing | Approved payment/subscription provider, products/prices, tax/legal decisions | 19 or later approval | Schema placeholder only until selected |

## Meta implementation checklist

At each integration milestone, record official documentation URL, review date, Graph/API version, account eligibility, requested permissions/features, app-review evidence, test users/assets, webhook fields, token type/lifetime/rotation, rate limits, supported content/statuses, deletion/data-use callbacks, and production verification results. Never treat mocks or development-mode test users as production proof.

Credential values belong only in approved secret stores/environment injection. Documentation contains placeholder names and acquisition/rotation steps, not secrets.

## Business and legal inputs

Before production the owner must approve terms/privacy policy, acceptable use, support-access policy, customer data processing terms, retention/deletion/export behavior, incident notification, regional/data-residency needs, WhatsApp consent/template practices, Meta platform terms, notification-content policy, subscription/refund/tax approach, and analytics/leaderboard fairness policy.

## Items that can wait

Real Meta assets, app review, WhatsApp templates, public webhook domains, Android signing/Play Console, production cloud resources, and billing-provider credentials are not blockers for Milestones 2-10 when official-behavior mocks and documented capability assumptions are used. Architecture must keep interfaces ready, but no live-success claim is allowed.

## Schedule risks

External approval times, account eligibility, changing provider APIs/policies, permission rejection, business verification, phone/template approval, app-store review, vendor quotas, and privacy/legal review are outside repository control. Begin checklists early enough, but acquire/use credentials only in their authorized milestone.

