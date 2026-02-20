DO $$ BEGIN
  CREATE TYPE media_transcode_status AS ENUM ('none', 'pending', 'processing', 'ready', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'video';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reaction_type AS ENUM ('worth_it', 'skip_it', 'family_friendly', 'budget_friendly', 'photogenic');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE prompt_type AS ENUM ('itinerary_gap', 'location_gap', 'day_reflection');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS thumbnail_key TEXT,
  ADD COLUMN IF NOT EXISTS transcode_status media_transcode_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS playback_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS aspect_ratio DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS entry_experience_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  value_for_money INTEGER NOT NULL CHECK (value_for_money BETWEEN 1 AND 5),
  would_repeat BOOLEAN NOT NULL,
  difficulty INTEGER CHECK (difficulty IS NULL OR (difficulty BETWEEN 1 AND 5)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_experience_ratings_entry_user_unique
  ON entry_experience_ratings(entry_id, user_id);
CREATE INDEX IF NOT EXISTS entry_experience_ratings_entry_created_idx
  ON entry_experience_ratings(entry_id, created_at);

CREATE TABLE IF NOT EXISTS waybook_day_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  summary_text TEXT,
  top_moment_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  mood_score INTEGER CHECK (mood_score IS NULL OR (mood_score BETWEEN 1 AND 5)),
  energy_score INTEGER CHECK (energy_score IS NULL OR (energy_score BETWEEN 1 AND 5)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waybook_day_summaries_waybook_date_unique
  ON waybook_day_summaries(waybook_id, summary_date);
CREATE INDEX IF NOT EXISTS waybook_day_summaries_waybook_date_idx
  ON waybook_day_summaries(waybook_id, summary_date);

CREATE TABLE IF NOT EXISTS entry_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  is_must_do BOOLEAN NOT NULL DEFAULT false,
  estimated_cost_min INTEGER,
  estimated_cost_max INTEGER,
  time_needed_minutes INTEGER,
  best_time_of_day VARCHAR(80),
  tips_text TEXT,
  accessibility_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_guidance_entry_unique
  ON entry_guidance(entry_id);

CREATE TABLE IF NOT EXISTS entry_reactions_public (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_fingerprint VARCHAR(160),
  reaction_type reaction_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entry_reactions_public_entry_created_idx
  ON entry_reactions_public(entry_id, created_at);

CREATE TABLE IF NOT EXISTS prompt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  prompt_type prompt_type NOT NULL,
  trigger_reason VARCHAR(120) NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prompt_events_user_scheduled_idx
  ON prompt_events(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS prompt_events_waybook_scheduled_idx
  ON prompt_events(waybook_id, scheduled_for);
