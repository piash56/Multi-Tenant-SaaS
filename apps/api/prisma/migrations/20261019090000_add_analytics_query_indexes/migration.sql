CREATE INDEX "messages_organization_id_author_membership_id_created_at_idx"
ON "messages"("organization_id", "author_membership_id", "created_at");

CREATE INDEX "messages_organization_id_direction_origin_created_at_idx"
ON "messages"("organization_id", "direction", "origin", "created_at");

CREATE INDEX "conversation_assignment_events_organization_id_from_membership_id_occurred_at_idx"
ON "conversation_assignment_events"("organization_id", "from_membership_id", "occurred_at");

CREATE INDEX "conversation_resolution_events_organization_id_actor_membership_id_action_occurred_at_idx"
ON "conversation_resolution_events"("organization_id", "actor_membership_id", "action", "occurred_at");
