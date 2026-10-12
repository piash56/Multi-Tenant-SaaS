-- Milestone 4: additive server-side authentication session state.
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "access_version" INTEGER NOT NULL DEFAULT 1,
    "authenticated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "user_agent" TEXT,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_family_id_key" ON "auth_sessions"("family_id");
CREATE INDEX "auth_sessions_user_id_revoked_at_expires_at_idx" ON "auth_sessions"("user_id", "revoked_at", "expires_at");
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key" ON "auth_refresh_tokens"("token_hash");
CREATE UNIQUE INDEX "auth_refresh_tokens_session_id_sequence_key" ON "auth_refresh_tokens"("session_id", "sequence");
CREATE INDEX "auth_refresh_tokens_session_id_revoked_at_expires_at_idx" ON "auth_refresh_tokens"("session_id", "revoked_at", "expires_at");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
