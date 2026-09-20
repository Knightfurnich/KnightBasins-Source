-- Adds up to 4 extra installed-example photos per basin, alongside the existing
-- primary image_url. Keep this migration safe for an existing database and existing rows.
ALTER TABLE public.basin_prices
  ADD COLUMN IF NOT EXISTS gallery_image_urls text[] NOT NULL DEFAULT '{}';
