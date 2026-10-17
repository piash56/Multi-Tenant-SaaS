-- Reconcile an older local test-only team schema with the reviewed Milestone 5 schema.
-- Every statement is additive/idempotent so the migration is also safe after
-- 20261018120000_add_organization_teams on normal development and CI databases.
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "normalized_name" TEXT;

UPDATE "teams"
SET "normalized_name" = lower(trim("name"))
WHERE "normalized_name" IS NULL;

ALTER TABLE "teams" ALTER COLUMN "normalized_name" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "teams_organization_id_normalized_name_key"
ON "teams"("organization_id", "normalized_name");

CREATE UNIQUE INDEX IF NOT EXISTS "team_memberships_team_id_membership_id_key"
ON "team_memberships"("team_id", "membership_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_memberships_organization_id_fkey'
  ) THEN
    ALTER TABLE "team_memberships"
      ADD CONSTRAINT "team_memberships_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
