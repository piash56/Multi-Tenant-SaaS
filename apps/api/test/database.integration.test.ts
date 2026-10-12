import { randomUUID } from "node:crypto";
import { Client, type QueryResult } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

let client: Client;
const query = (text: string, values: unknown[] = []): Promise<QueryResult> =>
  client.query(text, values);

async function expectSqlState(action: () => Promise<unknown>, code: string): Promise<void> {
  const savepoint = `expected_error_${randomUUID().replaceAll("-", "")}`;
  await query(`SAVEPOINT ${savepoint}`);
  try {
    await action();
    throw new Error(`Expected PostgreSQL SQLSTATE ${code}`);
  } catch (error) {
    expect(error).toMatchObject({ code });
  } finally {
    await query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

async function createOrganization(name: string) {
  const id = randomUUID();
  await query(`INSERT INTO organizations (id, name, slug, updated_at) VALUES ($1, $2, $3, now())`, [
    id,
    name,
    `${name.toLowerCase()}-${id}`,
  ]);
  return id;
}

async function createMembership(organizationId: string, label: string) {
  const userId = randomUUID();
  const membershipId = randomUUID();
  const email = `${label}-${userId}@example.test`;
  await query(
    `INSERT INTO users (id, email, normalized_email, updated_at) VALUES ($1, $2, $2, now())`,
    [userId, email],
  );
  await query(
    `INSERT INTO memberships (id, organization_id, user_id, role, status, display_name, updated_at)
     VALUES ($1, $2, $3, 'MODERATOR', 'ACTIVE', $4, now())`,
    [membershipId, organizationId, userId, label],
  );
  return { userId, membershipId };
}

async function createInboxFixture(organizationId: string, suffix: string) {
  const accountId = randomUUID();
  const contactId = randomUUID();
  const identityId = randomUUID();
  const conversationId = randomUUID();
  await query(
    `INSERT INTO connected_channel_accounts
      (id, organization_id, platform, provider_account_id, display_name, updated_at)
     VALUES ($1, $2, 'FACEBOOK_MESSENGER', $3, $4, now())`,
    [accountId, organizationId, `account-${suffix}`, `Account ${suffix}`],
  );
  await query(
    `INSERT INTO contacts (id, organization_id, display_name, updated_at) VALUES ($1, $2, $3, now())`,
    [contactId, organizationId, `Contact ${suffix}`],
  );
  await query(
    `INSERT INTO contact_identities
      (id, organization_id, contact_id, connected_channel_account_id, platform, provider_user_id)
     VALUES ($1, $2, $3, $4, 'FACEBOOK_MESSENGER', $5)`,
    [identityId, organizationId, contactId, accountId, `person-${suffix}`],
  );
  await query(
    `INSERT INTO conversations
      (id, organization_id, connected_channel_account_id, contact_id, provider_thread_key, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [conversationId, organizationId, accountId, contactId, `thread-${suffix}`],
  );
  return { accountId, contactId, identityId, conversationId };
}

beforeEach(async () => {
  client = new Client({ connectionString });
  await client.connect();
  await query("BEGIN");
});

afterEach(async () => {
  await query("ROLLBACK");
  await client.end();
});

describe("Milestone 3 database", () => {
  it("contains the applied migration and core business tables", async () => {
    const migration = await query(
      `SELECT finished_at FROM _prisma_migrations WHERE migration_name = $1`,
      ["20261012184311_initial_business_schema"],
    );
    expect(migration.rowCount).toBe(1);
    expect(migration.rows[0].finished_at).toBeTruthy();
    const tables = await query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('organizations', 'messages', 'social_comments', 'webhook_events', 'outbox_events')`,
    );
    expect(tables.rowCount).toBe(5);
  });

  it("enforces organization membership uniqueness", async () => {
    const orgId = await createOrganization("Membership");
    const member = await createMembership(orgId, "One");
    await expectSqlState(
      () =>
        query(
          `INSERT INTO memberships (organization_id, user_id, role, status, display_name, updated_at)
           VALUES ($1, $2, 'SUPERVISOR', 'ACTIVE', 'Duplicate', now())`,
          [orgId, member.userId],
        ),
      "23505",
    );
  });

  it("rejects cross-tenant parents and assignees", async () => {
    const tenantA = await createOrganization("TenantA");
    const tenantB = await createOrganization("TenantB");
    const inboxA = await createInboxFixture(tenantA, randomUUID());
    const memberB = await createMembership(tenantB, "Tenant B moderator");
    await expectSqlState(
      () =>
        query(
          `UPDATE conversations SET current_assignee_membership_id = $1
           WHERE organization_id = $2 AND id = $3`,
          [memberB.membershipId, tenantA, inboxA.conversationId],
        ),
      "23503",
    );
    await expectSqlState(
      () =>
        query(
          `INSERT INTO messages
            (organization_id, conversation_id, connected_channel_account_id, direction, origin,
             external_sender_identity_id, provider_message_id, updated_at)
           VALUES ($1, $2, $3, 'INBOUND', 'EXTERNAL', $4, 'cross-tenant', now())`,
          [tenantB, inboxA.conversationId, inboxA.accountId, inboxA.identityId],
        ),
      "23503",
    );
  });

  it("deduplicates webhook events and external messages in the correct scope", async () => {
    const orgId = await createOrganization("Dedupe");
    const inbox = await createInboxFixture(orgId, randomUUID());
    await query(
      `INSERT INTO webhook_events (platform, external_event_key, payload_hash)
       VALUES ('FACEBOOK_MESSENGER', 'delivery-1', 'hash-1')`,
    );
    await expectSqlState(
      () =>
        query(
          `INSERT INTO webhook_events (platform, external_event_key, payload_hash)
           VALUES ('FACEBOOK_MESSENGER', 'delivery-1', 'hash-2')`,
        ),
      "23505",
    );
    const insertMessage = () =>
      query(
        `INSERT INTO messages
          (organization_id, conversation_id, connected_channel_account_id, direction, origin,
          external_sender_identity_id, provider_message_id, updated_at)
         VALUES ($1, $2, $3, 'INBOUND', 'EXTERNAL', $4, 'provider-message-1', now())`,
        [orgId, inbox.conversationId, inbox.accountId, inbox.identityId],
      );
    await insertMessage();
    await expectSqlState(insertMessage, "23505");
  });

  it("keeps assignment history and actual reply author separate", async () => {
    const orgId = await createOrganization("Attribution");
    const inbox = await createInboxFixture(orgId, randomUUID());
    const assignee = await createMembership(orgId, "Primary assignee");
    const author = await createMembership(orgId, "Reply author");
    await query(`UPDATE conversations SET current_assignee_membership_id = $1 WHERE id = $2`, [
      assignee.membershipId,
      inbox.conversationId,
    ]);
    await query(
      `INSERT INTO conversation_assignment_events
        (organization_id, conversation_id, to_membership_id, actor_membership_id, reason)
       VALUES ($1, $2, $3, $3, 'INITIAL_ASSIGNMENT')`,
      [orgId, inbox.conversationId, assignee.membershipId],
    );
    await query(
      `INSERT INTO messages
        (organization_id, conversation_id, connected_channel_account_id, direction, origin,
         author_membership_id, assignee_at_send_membership_id, author_display_name_snapshot,
         assignee_display_name_snapshot, client_idempotency_key, body, updated_at)
       VALUES ($1, $2, $3, 'OUTBOUND', 'HUMAN', $4, $5, 'Reply author',
               'Primary assignee', 'reply-1', 'Synthetic reply', now())`,
      [orgId, inbox.conversationId, inbox.accountId, author.membershipId, assignee.membershipId],
    );
    const result = await query(
      `SELECT c.current_assignee_membership_id, m.author_membership_id,
              m.assignee_at_send_membership_id,
              (SELECT count(*)::int FROM conversation_assignment_events e WHERE e.conversation_id = c.id) event_count
       FROM conversations c JOIN messages m ON m.conversation_id = c.id WHERE c.id = $1`,
      [inbox.conversationId],
    );
    expect(result.rows[0]).toMatchObject({
      current_assignee_membership_id: assignee.membershipId,
      author_membership_id: author.membershipId,
      assignee_at_send_membership_id: assignee.membershipId,
      event_count: 1,
    });
  });

  it("models social comment parentage and rejects a cross-tenant parent", async () => {
    const tenantA = await createOrganization("CommentsA");
    const tenantB = await createOrganization("CommentsB");
    const inboxA = await createInboxFixture(tenantA, randomUUID());
    const inboxB = await createInboxFixture(tenantB, randomUUID());
    const postA = randomUUID();
    const postB = randomUUID();
    const commentA = randomUUID();
    await query(
      `INSERT INTO social_posts (id, organization_id, connected_channel_account_id, provider_post_id)
       VALUES ($1, $2, $3, 'post-a'), ($4, $5, $6, 'post-b')`,
      [postA, tenantA, inboxA.accountId, postB, tenantB, inboxB.accountId],
    );
    await query(
      `INSERT INTO social_comments
        (id, organization_id, connected_channel_account_id, social_post_id, provider_comment_id)
       VALUES ($1, $2, $3, $4, 'comment-a')`,
      [commentA, tenantA, inboxA.accountId, postA],
    );
    await expectSqlState(
      () =>
        query(
          `INSERT INTO social_comments
            (organization_id, connected_channel_account_id, social_post_id, parent_comment_id, provider_comment_id)
           VALUES ($1, $2, $3, $4, 'cross-parent')`,
          [tenantB, inboxB.accountId, postB, commentA],
        ),
      "23503",
    );
  });

  it("protects referenced tenant records from deletion", async () => {
    const orgId = await createOrganization("Referential");
    await createMembership(orgId, "Member");
    await expectSqlState(() => query(`DELETE FROM organizations WHERE id = $1`, [orgId]), "23001");
  });
});
