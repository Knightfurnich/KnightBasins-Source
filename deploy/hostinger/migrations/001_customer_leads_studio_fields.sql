-- Studio quote fields added with the 2D saved-quote release.
-- Keep this migration safe for an existing database and existing rows.
ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS order_mode varchar(32) DEFAULT 'quick-purchase' NOT NULL;

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS studio_data jsonb;

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS sketch_url text;