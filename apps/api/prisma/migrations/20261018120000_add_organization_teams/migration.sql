CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_organization_id_id_key" ON "teams"("organization_id", "id");
CREATE UNIQUE INDEX "teams_organization_id_normalized_name_key" ON "teams"("organization_id", "normalized_name");
CREATE INDEX "teams_organization_id_is_active_name_idx" ON "teams"("organization_id", "is_active", "name");
CREATE UNIQUE INDEX "team_memberships_team_id_membership_id_key" ON "team_memberships"("team_id", "membership_id");
CREATE INDEX "team_memberships_organization_id_membership_id_idx" ON "team_memberships"("organization_id", "membership_id");

ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_organization_id_team_id_fkey"
FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_organization_id_membership_id_fkey"
FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
