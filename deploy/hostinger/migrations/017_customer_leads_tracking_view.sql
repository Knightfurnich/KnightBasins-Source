-- Customer tracking-link view log (job-152): lets admins see whether a
-- customer has opened their /track?token=... link and how many times.
-- Nullable/defaulted additions only -- existing rows/columns are untouched.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS tracking_view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_viewed_at timestamptz;
