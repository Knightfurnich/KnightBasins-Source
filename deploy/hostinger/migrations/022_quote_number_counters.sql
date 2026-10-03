CREATE TABLE IF NOT EXISTS quote_number_counters (
  period text PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);