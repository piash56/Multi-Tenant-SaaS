-- RenameForeignKey
ALTER TABLE "billing_events" RENAME CONSTRAINT "billing_events_organization_subscription_fkey" TO "billing_events_organization_id_subscription_id_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_assignment_events" RENAME CONSTRAINT "assignment_events_actor_membership_fkey" TO "conversation_assignment_events_organization_id_actor_membe_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_assignment_events" RENAME CONSTRAINT "assignment_events_from_membership_fkey" TO "conversation_assignment_events_organization_id_from_member_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_assignment_events" RENAME CONSTRAINT "assignment_events_to_membership_fkey" TO "conversation_assignment_events_organization_id_to_membersh_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_resolution_events" RENAME CONSTRAINT "resolution_events_actor_membership_fkey" TO "conversation_resolution_events_organization_id_actor_membe_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_resolution_events" RENAME CONSTRAINT "resolution_events_assignee_membership_fkey" TO "conversation_resolution_events_organization_id_assignee_at_fkey";

-- RenameForeignKey
ALTER TABLE "conversation_resolution_events" RENAME CONSTRAINT "resolution_events_credit_membership_fkey" TO "conversation_resolution_events_organization_id_completion__fkey";

-- RenameForeignKey
ALTER TABLE "social_comment_replies" RENAME CONSTRAINT "social_comment_replies_account_fkey" TO "social_comment_replies_organization_id_connected_channel_a_fkey";

-- RenameForeignKey
ALTER TABLE "social_comment_replies" RENAME CONSTRAINT "social_comment_replies_assignee_membership_fkey" TO "social_comment_replies_organization_id_assignee_at_send_me_fkey";

-- RenameForeignKey
ALTER TABLE "social_comment_replies" RENAME CONSTRAINT "social_comment_replies_author_membership_fkey" TO "social_comment_replies_organization_id_author_membership_i_fkey";

-- RenameForeignKey
ALTER TABLE "social_comments" RENAME CONSTRAINT "social_comments_assignee_membership_fkey" TO "social_comments_organization_id_current_assignee_membershi_fkey";
