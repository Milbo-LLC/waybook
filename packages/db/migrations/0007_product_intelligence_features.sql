CREATE TABLE IF NOT EXISTS product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  waybook_id UUID REFERENCES waybooks(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_events_type_created_idx ON product_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS product_events_waybook_created_idx ON product_events(waybook_id, created_at);

CREATE TABLE IF NOT EXISTS assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  objective VARCHAR(500),
  draft_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_sessions_waybook_created_idx ON assistant_sessions(waybook_id, created_at);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_messages_session_created_idx ON assistant_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS trip_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  scenario_type VARCHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_scenarios_waybook_type_unique ON trip_scenarios(waybook_id, scenario_type);
CREATE INDEX IF NOT EXISTS trip_scenarios_waybook_created_idx ON trip_scenarios(waybook_id, created_at);

CREATE TABLE IF NOT EXISTS trip_scenario_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES trip_scenarios(id) ON DELETE CASCADE,
  item_type VARCHAR(24) NOT NULL,
  source_id UUID,
  label VARCHAR(220) NOT NULL,
  details TEXT,
  score INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trip_scenario_items_scenario_order_idx ON trip_scenario_items(scenario_id, order_index);

CREATE TABLE IF NOT EXISTS decision_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybook_id UUID NOT NULL REFERENCES waybooks(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(220) NOT NULL,
  scope VARCHAR(40) NOT NULL DEFAULT 'planning',
  summary TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_rounds_waybook_created_idx ON decision_rounds(waybook_id, created_at);
