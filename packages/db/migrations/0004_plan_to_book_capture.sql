DO $$ BEGIN
  CREATE TYPE planning_item_status AS ENUM ('idea', 'shortlisted', 'planned', 'booked', 'done', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('activity', 'stay', 'transport', 'flight', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('draft', 'pending_checkout', 'confirmed', 'cancelled', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_split_method AS ENUM ('equal', 'custom', 'percentage', 'shares');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM ('logged', 'settled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('task_due', 'booking_deadline', 'day_plan_start', 'summary_prompt');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS planning_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  category VARCHAR(80),
  status planning_item_status NOT NULL DEFAULT 'idea',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_name VARCHAR(200),
  estimated_cost_min INTEGER,
  estimated_cost_max INTEGER,
  source_url TEXT,
  provider_hint VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_items_waybook_status_created_idx
  ON planning_items(waybook_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS planning_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_item_id UUID NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote VARCHAR(8) NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS planning_votes_item_user_unique
  ON planning_votes(planning_item_id, user_id);
CREATE INDEX IF NOT EXISTS planning_votes_item_created_idx
  ON planning_votes(planning_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS planning_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_item_id UUID NOT NULL REFERENCES planning_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_comments_item_created_idx
  ON planning_comments(planning_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trip_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_tasks_waybook_status_due_idx
  ON trip_tasks(waybook_id, status, due_at);

CREATE TABLE IF NOT EXISTS booking_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  planning_item_id UUID REFERENCES planning_items(id) ON DELETE SET NULL,
  type booking_type NOT NULL,
  provider VARCHAR(80),
  provider_booking_id VARCHAR(160),
  title VARCHAR(220) NOT NULL,
  booked_for_start TIMESTAMPTZ,
  booked_for_end TIMESTAMPTZ,
  booking_status booking_status NOT NULL DEFAULT 'draft',
  checkout_url TEXT,
  confirmation_code VARCHAR(120),
  booked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  currency VARCHAR(8),
  total_amount_minor INTEGER,
  refund_policy_text TEXT,
  cancellation_deadline TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_records_waybook_status_start_idx
  ON booking_records(waybook_id, booking_status, booked_for_start);
CREATE INDEX IF NOT EXISTS booking_records_provider_external_idx
  ON booking_records(provider, provider_booking_id);

CREATE TABLE IF NOT EXISTS booking_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_record_id UUID NOT NULL REFERENCES booking_records(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  label VARCHAR(140),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_documents_booking_created_idx
  ON booking_documents(booking_record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  booking_record_id UUID REFERENCES booking_records(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  category VARCHAR(80),
  paid_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(8) NOT NULL,
  amount_minor INTEGER NOT NULL,
  trip_base_currency VARCHAR(8) NOT NULL,
  trip_base_amount_minor INTEGER NOT NULL,
  fx_rate DOUBLE PRECISION,
  incurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  split_method expense_split_method NOT NULL DEFAULT 'equal',
  status expense_status NOT NULL DEFAULT 'logged',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_entries_waybook_incurred_idx
  ON expense_entries(waybook_id, incurred_at DESC);

CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_entry_id UUID NOT NULL REFERENCES expense_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor INTEGER,
  percentage INTEGER,
  shares INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_splits_expense_user_unique
  ON expense_splits(expense_entry_id, user_id);
CREATE INDEX IF NOT EXISTS expense_splits_expense_user_idx
  ON expense_splits(expense_entry_id, user_id);

CREATE TABLE IF NOT EXISTS itinerary_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  planning_item_id UUID REFERENCES planning_items(id) ON DELETE SET NULL,
  booking_record_id UUID REFERENCES booking_records(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  buffer_before_min INTEGER,
  buffer_after_min INTEGER,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itinerary_events_waybook_start_idx
  ON itinerary_events(waybook_id, start_time);

CREATE TABLE IF NOT EXISTS entry_itinerary_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  itinerary_event_id UUID NOT NULL REFERENCES itinerary_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_itinerary_links_entry_event_unique
  ON entry_itinerary_links(entry_id, itinerary_event_id);
CREATE INDEX IF NOT EXISTS entry_itinerary_links_entry_created_idx
  ON entry_itinerary_links(entry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trip_preferences (
  waybook_id UUID PRIMARY KEY REFERENCES waybooks(id) ON DELETE CASCADE,
  base_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  pace VARCHAR(40),
  budget_tier VARCHAR(40),
  accessibility_notes TEXT,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  notification_type notification_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  lead_time_min INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_rules_waybook_user_channel_type_unique
  ON notification_rules(waybook_id, user_id, channel, notification_type);

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  payload JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_events_user_scheduled_status_idx
  ON notification_events(user_id, scheduled_for, status);
