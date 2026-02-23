ALTER TABLE waybooks
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE waybooks
  ADD COLUMN IF NOT EXISTS timeframe_label VARCHAR(120),
  ADD COLUMN IF NOT EXISTS earliest_start_date DATE,
  ADD COLUMN IF NOT EXISTS latest_end_date DATE;

ALTER TABLE trip_preferences
  ADD COLUMN IF NOT EXISTS budget_amount_minor INTEGER,
  ADD COLUMN IF NOT EXISTS budget_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS default_split_method expense_split_method NOT NULL DEFAULT 'equal';
