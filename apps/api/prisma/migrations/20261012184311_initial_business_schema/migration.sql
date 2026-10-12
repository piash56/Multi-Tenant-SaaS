-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ORGANIZATION_ADMIN', 'SUPERVISOR', 'MODERATOR');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK_MESSENGER', 'INSTAGRAM', 'WHATSAPP_BUSINESS');

-- CreateEnum
CREATE TYPE "ChannelAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageOrigin" AS ENUM ('EXTERNAL', 'HUMAN', 'SYSTEM', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "AssignmentReason" AS ENUM ('INITIAL_ASSIGNMENT', 'SELF_CLAIM', 'MANUAL_REASSIGNMENT', 'UNASSIGNED', 'AUTOMATION', 'CORRECTION');

-- CreateEnum
CREATE TYPE "ResolutionAction" AS ENUM ('RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ResolutionSource" AS ENUM ('HUMAN', 'INBOUND_ACTIVITY', 'PROVIDER', 'AUTOMATION', 'CORRECTION');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "WebhookProcessingState" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'RETRY_PENDING', 'FAILED', 'QUARANTINED', 'IGNORED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "platform_role" "PlatformRole" NOT NULL DEFAULT 'USER',
    "email_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "settings_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "display_name" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token_hash" TEXT NOT NULL,
    "inviter_membership_id" UUID,
    "inviter_user_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_channel_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "ChannelAccountStatus" NOT NULL DEFAULT 'PENDING',
    "encrypted_token" TEXT,
    "token_key_version" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "disconnected_at" TIMESTAMPTZ(6),

    CONSTRAINT "connected_channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "display_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "connected_channel_account_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "username" TEXT,
    "display_name_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "connected_channel_account_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "provider_thread_key" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "current_assignee_membership_id" UUID,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "connected_channel_account_id" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "origin" "MessageOrigin" NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "provider_message_id" TEXT,
    "client_idempotency_key" TEXT,
    "external_sender_identity_id" UUID,
    "author_membership_id" UUID,
    "assignee_at_send_membership_id" UUID,
    "author_display_name_snapshot" TEXT,
    "assignee_display_name_snapshot" TEXT,
    "system_actor" TEXT,
    "body" TEXT,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "provider_created_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "provider_event_id" TEXT,
    "error_code" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "provider_media_id" TEXT,
    "scan_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_assignment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "from_membership_id" UUID,
    "to_membership_id" UUID,
    "actor_membership_id" UUID,
    "reason" "AssignmentReason" NOT NULL,
    "request_id" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_resolution_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "action" "ResolutionAction" NOT NULL,
    "source" "ResolutionSource" NOT NULL,
    "actor_membership_id" UUID,
    "assignee_at_action_membership_id" UUID,
    "completion_credit_membership_id" UUID,
    "completion_policy_version" INTEGER,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_resolution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "connected_channel_account_id" UUID NOT NULL,
    "provider_post_id" TEXT NOT NULL,
    "permalink" TEXT,
    "caption_snapshot" TEXT,
    "provider_created_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "connected_channel_account_id" UUID NOT NULL,
    "social_post_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "external_author_identity_id" UUID,
    "provider_comment_id" TEXT NOT NULL,
    "author_display_name_snapshot" TEXT,
    "body" TEXT,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "current_assignee_membership_id" UUID,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider_created_at" TIMESTAMPTZ(6),
    "edited_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_comment_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "social_comment_id" UUID NOT NULL,
    "connected_channel_account_id" UUID NOT NULL,
    "provider_reply_id" TEXT,
    "client_idempotency_key" TEXT,
    "author_membership_id" UUID NOT NULL,
    "assignee_at_send_membership_id" UUID,
    "author_display_name_snapshot" TEXT NOT NULL,
    "assignee_display_name_snapshot" TEXT,
    "body" TEXT NOT NULL,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_comment_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "connected_channel_account_id" UUID,
    "platform" "SocialPlatform" NOT NULL,
    "external_event_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload_ciphertext" TEXT,
    "signature_verified" BOOLEAN NOT NULL DEFAULT false,
    "processing_state" "WebhookProcessingState" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "provider_occurred_at" TIMESTAMPTZ(6),
    "provider_sequence" TEXT,
    "next_attempt_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_attempt_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "actor_user_id" UUID,
    "actor_membership_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "result" TEXT NOT NULL,
    "request_id" TEXT,
    "ip_address" INET,
    "user_agent" TEXT,
    "changes" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "recipient_membership_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "idempotency_key" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "provider" TEXT,
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "plan_key" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RECEIVED',
    "occurred_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "memberships_organization_id_role_status_idx" ON "memberships"("organization_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_id_key" ON "memberships"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_normalized_email_status_idx" ON "invitations"("organization_id", "normalized_email", "status");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE INDEX "connected_channel_accounts_organization_id_status_idx" ON "connected_channel_accounts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connected_channel_accounts_platform_provider_account_id_key" ON "connected_channel_accounts"("platform", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "connected_channel_accounts_organization_id_id_key" ON "connected_channel_accounts"("organization_id", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_display_name_idx" ON "contacts"("organization_id", "display_name");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_id_key" ON "contacts"("organization_id", "id");

-- CreateIndex
CREATE INDEX "contact_identities_organization_id_contact_id_idx" ON "contact_identities"("organization_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_identities_connected_channel_account_id_provider_us_key" ON "contact_identities"("connected_channel_account_id", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_identities_organization_id_id_key" ON "contact_identities"("organization_id", "id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_status_last_activity_at_id_idx" ON "conversations"("organization_id", "status", "last_activity_at", "id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_current_assignee_membership_i_idx" ON "conversations"("organization_id", "current_assignee_membership_id", "last_activity_at");

-- CreateIndex
CREATE INDEX "conversations_organization_id_unread_count_last_activity_at_idx" ON "conversations"("organization_id", "unread_count", "last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_connected_channel_account_id_provider_thread__key" ON "conversations"("connected_channel_account_id", "provider_thread_key");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_organization_id_id_key" ON "conversations"("organization_id", "id");

-- CreateIndex
CREATE INDEX "messages_organization_id_conversation_id_created_at_id_idx" ON "messages"("organization_id", "conversation_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_connected_channel_account_id_direction_provider_me_key" ON "messages"("connected_channel_account_id", "direction", "provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_organization_id_client_idempotency_key_key" ON "messages"("organization_id", "client_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "messages_organization_id_id_key" ON "messages"("organization_id", "id");

-- CreateIndex
CREATE INDEX "message_status_events_organization_id_message_id_occurred_a_idx" ON "message_status_events"("organization_id", "message_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_status_events_organization_id_provider_event_id_key" ON "message_status_events"("organization_id", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_organization_id_scan_status_idx" ON "attachments"("organization_id", "scan_status");

-- CreateIndex
CREATE INDEX "conversation_assignment_events_organization_id_conversation_idx" ON "conversation_assignment_events"("organization_id", "conversation_id", "occurred_at");

-- CreateIndex
CREATE INDEX "conversation_assignment_events_organization_id_to_membershi_idx" ON "conversation_assignment_events"("organization_id", "to_membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "conversation_resolution_events_organization_id_conversation_idx" ON "conversation_resolution_events"("organization_id", "conversation_id", "occurred_at");

-- CreateIndex
CREATE INDEX "conversation_resolution_events_organization_id_completion_c_idx" ON "conversation_resolution_events"("organization_id", "completion_credit_membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "social_posts_organization_id_provider_created_at_idx" ON "social_posts"("organization_id", "provider_created_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_connected_channel_account_id_provider_post_id_key" ON "social_posts"("connected_channel_account_id", "provider_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_organization_id_id_key" ON "social_posts"("organization_id", "id");

-- CreateIndex
CREATE INDEX "social_comments_organization_id_status_last_activity_at_idx" ON "social_comments"("organization_id", "status", "last_activity_at");

-- CreateIndex
CREATE INDEX "social_comments_organization_id_current_assignee_membership_idx" ON "social_comments"("organization_id", "current_assignee_membership_id", "last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_comments_connected_channel_account_id_provider_comme_key" ON "social_comments"("connected_channel_account_id", "provider_comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_comments_organization_id_id_key" ON "social_comments"("organization_id", "id");

-- CreateIndex
CREATE INDEX "social_comment_replies_organization_id_social_comment_id_cr_idx" ON "social_comment_replies"("organization_id", "social_comment_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "social_comment_replies_connected_channel_account_id_provide_key" ON "social_comment_replies"("connected_channel_account_id", "provider_reply_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_comment_replies_organization_id_client_idempotency_k_key" ON "social_comment_replies"("organization_id", "client_idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_events_processing_state_next_attempt_at_received_at_idx" ON "webhook_events"("processing_state", "next_attempt_at", "received_at");

-- CreateIndex
CREATE INDEX "webhook_events_organization_id_received_at_idx" ON "webhook_events"("organization_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_platform_external_event_key_key" ON "webhook_events"("platform", "external_event_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_occurred_at_idx" ON "outbox_events"("status", "next_attempt_at", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_organization_id_occurred_at_idx" ON "outbox_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_membership_id_read__idx" ON "notifications"("organization_id", "recipient_membership_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_membership_id_idempotency_key_key" ON "notifications"("recipient_membership_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_operation_key_key" ON "idempotency_records"("organization_id", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_customer_id_key" ON "subscriptions"("provider_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_status_idx" ON "subscriptions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "billing_events_organization_id_received_at_idx" ON "billing_events"("organization_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_provider_event_id_key" ON "billing_events"("provider", "provider_event_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_inviter_membership_id_fkey" FOREIGN KEY ("organization_id", "inviter_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_channel_accounts" ADD CONSTRAINT "connected_channel_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_organization_id_connected_channel_accou_fkey" FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_connected_channel_account_id_fkey" FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_current_assignee_membership__fkey" FOREIGN KEY ("organization_id", "current_assignee_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_connected_channel_account_id_fkey" FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_external_sender_identity_id_fkey" FOREIGN KEY ("organization_id", "external_sender_identity_id") REFERENCES "contact_identities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_author_membership_id_fkey" FOREIGN KEY ("organization_id", "author_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_assignee_at_send_membership_id_fkey" FOREIGN KEY ("organization_id", "assignee_at_send_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_status_events" ADD CONSTRAINT "message_status_events_organization_id_message_id_fkey" FOREIGN KEY ("organization_id", "message_id") REFERENCES "messages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_message_id_fkey" FOREIGN KEY ("organization_id", "message_id") REFERENCES "messages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_assignment_events" ADD CONSTRAINT "conversation_assignment_events_organization_id_conversatio_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_resolution_events" ADD CONSTRAINT "conversation_resolution_events_organization_id_conversatio_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_organization_id_connected_channel_account_id_fkey" FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_organization_id_social_post_id_fkey" FOREIGN KEY ("organization_id", "social_post_id") REFERENCES "social_posts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_organization_id_parent_comment_id_fkey" FOREIGN KEY ("organization_id", "parent_comment_id") REFERENCES "social_comments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_organization_id_external_author_identity_i_fkey" FOREIGN KEY ("organization_id", "external_author_identity_id") REFERENCES "contact_identities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_organization_id_connected_channel_account__fkey" FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_organization_id_social_comment_id_fkey" FOREIGN KEY ("organization_id", "social_comment_id") REFERENCES "social_comments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_connected_channel_account_i_fkey" FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_recipient_membership_id_fkey" FOREIGN KEY ("organization_id", "recipient_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not express partial indexes or every audit-only relationship cleanly.
-- These constraints are part of the authoritative migration and preserve tenant identity.
CREATE UNIQUE INDEX "invitations_one_pending_per_organization_email"
ON "invitations" ("organization_id", "normalized_email")
WHERE "status" = 'PENDING';

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_unread_count_nonnegative"
CHECK ("unread_count" >= 0);

ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_attempt_count_nonnegative"
CHECK ("attempt_count" >= 0);

ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_attempt_count_nonnegative"
CHECK ("attempt_count" >= 0);

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_byte_size_nonnegative"
CHECK ("byte_size" >= 0);

ALTER TABLE "messages" ADD CONSTRAINT "messages_origin_actor_consistency"
CHECK (
  ("origin" = 'EXTERNAL' AND "direction" = 'INBOUND' AND "external_sender_identity_id" IS NOT NULL AND "author_membership_id" IS NULL)
  OR ("origin" = 'HUMAN' AND "direction" = 'OUTBOUND' AND "author_membership_id" IS NOT NULL AND "author_display_name_snapshot" IS NOT NULL AND "external_sender_identity_id" IS NULL)
  OR ("origin" IN ('SYSTEM', 'AUTOMATION') AND "author_membership_id" IS NULL AND "external_sender_identity_id" IS NULL AND "system_actor" IS NOT NULL)
);

ALTER TABLE "conversation_assignment_events" ADD CONSTRAINT "assignment_events_from_membership_fkey"
FOREIGN KEY ("organization_id", "from_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_assignment_events" ADD CONSTRAINT "assignment_events_to_membership_fkey"
FOREIGN KEY ("organization_id", "to_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_assignment_events" ADD CONSTRAINT "assignment_events_actor_membership_fkey"
FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_resolution_events" ADD CONSTRAINT "resolution_events_actor_membership_fkey"
FOREIGN KEY ("organization_id", "actor_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_resolution_events" ADD CONSTRAINT "resolution_events_assignee_membership_fkey"
FOREIGN KEY ("organization_id", "assignee_at_action_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_resolution_events" ADD CONSTRAINT "resolution_events_credit_membership_fkey"
FOREIGN KEY ("organization_id", "completion_credit_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_resolution_events" ADD CONSTRAINT "resolution_credit_policy_consistency"
CHECK (("completion_credit_membership_id" IS NULL) OR ("action" = 'RESOLVED' AND "completion_policy_version" IS NOT NULL));

ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_assignee_membership_fkey"
FOREIGN KEY ("organization_id", "current_assignee_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_account_fkey"
FOREIGN KEY ("organization_id", "connected_channel_account_id") REFERENCES "connected_channel_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_author_membership_fkey"
FOREIGN KEY ("organization_id", "author_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_comment_replies" ADD CONSTRAINT "social_comment_replies_assignee_membership_fkey"
FOREIGN KEY ("organization_id", "assignee_at_send_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_id_key" UNIQUE ("organization_id", "id");
ALTER TABLE "billing_events" DROP CONSTRAINT "billing_events_subscription_id_fkey";
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_subscription_fkey"
FOREIGN KEY ("organization_id", "subscription_id") REFERENCES "subscriptions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
