DO $$
BEGIN
  CREATE TYPE trip_stage AS ENUM ('destinations', 'activities', 'booking', 'itinerary', 'prep', 'capture', 'replay');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE stage_status AS ENUM ('locked', 'available', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE destination_status AS ENUM ('proposed', 'locked', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE activity_status AS ENUM ('suggested', 'shortlisted', 'locked', 'discarded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE message_scope AS ENUM ('trip', 'dm');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE message_delivery_status AS ENUM ('sent', 'failed', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE itinerary_events
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS generation_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_by_booking BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS trip_stage_state (
  waybook_id UUID PRIMARY KEY REFERENCES waybooks(id) ON DELETE CASCADE,
  current_stage trip_stage NOT NULL DEFAULT 'destinations',
  stage_meta_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(220) NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_id VARCHAR(160),
  rationale TEXT,
  status destination_status NOT NULL DEFAULT 'proposed',
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_destinations_waybook_status_created_idx
  ON trip_destinations(waybook_id, status, created_at);

CREATE TABLE IF NOT EXISTS destination_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES trip_destinations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS destination_votes_destination_user_unique
  ON destination_votes(destination_id, user_id);
CREATE INDEX IF NOT EXISTS destination_votes_destination_created_idx
  ON destination_votes(destination_id, created_at);

CREATE TABLE IF NOT EXISTS activity_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES trip_destinations(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  provider_hint VARCHAR(80),
  source_url TEXT,
  estimated_cost_min INTEGER,
  estimated_cost_max INTEGER,
  duration_min INTEGER,
  status activity_status NOT NULL DEFAULT 'suggested',
  confidence_score INTEGER NOT NULL DEFAULT 50,
  research_payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_candidates_waybook_status_created_idx
  ON activity_candidates(waybook_id, status, created_at);

CREATE TABLE IF NOT EXISTS activity_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_candidate_id UUID NOT NULL REFERENCES activity_candidates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS activity_votes_candidate_user_unique
  ON activity_votes(activity_candidate_id, user_id);
CREATE INDEX IF NOT EXISTS activity_votes_candidate_created_idx
  ON activity_votes(activity_candidate_id, created_at);

CREATE TABLE IF NOT EXISTS trip_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  category VARCHAR(80),
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'todo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_checklist_items_waybook_status_due_idx
  ON trip_checklist_items(waybook_id, status, due_at);

CREATE TABLE IF NOT EXISTS trip_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  scope message_scope NOT NULL,
  thread_key VARCHAR(120) NOT NULL,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_messages_waybook_thread_created_idx
  ON trip_messages(waybook_id, thread_key, created_at);
CREATE INDEX IF NOT EXISTS trip_messages_waybook_scope_created_idx
  ON trip_messages(waybook_id, scope, created_at);

CREATE TABLE IF NOT EXISTS trip_message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES trip_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status message_delivery_status NOT NULL DEFAULT 'sent',
  read_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS trip_message_receipts_message_user_unique
  ON trip_message_receipts(message_id, user_id);
CREATE INDEX IF NOT EXISTS trip_message_receipts_user_status_idx
  ON trip_message_receipts(user_id, status);
