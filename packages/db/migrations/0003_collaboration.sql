DO $$ BEGIN
  CREATE TYPE waybook_member_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS waybook_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role waybook_member_role NOT NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waybook_members_waybook_user_unique
  ON waybook_members(waybook_id, user_id);
CREATE INDEX IF NOT EXISTS waybook_members_user_idx
  ON waybook_members(user_id);
CREATE INDEX IF NOT EXISTS waybook_members_waybook_role_idx
  ON waybook_members(waybook_id, role);

CREATE TABLE IF NOT EXISTS waybook_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL,
  token_hash TEXT NOT NULL,
  role waybook_member_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waybook_invites_token_hash_unique
  ON waybook_invites(token_hash);
CREATE INDEX IF NOT EXISTS waybook_invites_waybook_email_idx
  ON waybook_invites(waybook_id, email);
CREATE INDEX IF NOT EXISTS waybook_invites_waybook_created_idx
  ON waybook_invites(waybook_id, created_at);

INSERT INTO waybook_members (waybook_id, user_id, role)
SELECT id, user_id, 'owner'::waybook_member_role
FROM waybooks
ON CONFLICT (waybook_id, user_id) DO NOTHING;
