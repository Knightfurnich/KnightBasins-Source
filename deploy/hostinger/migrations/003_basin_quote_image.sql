-- Lets an admin pin a specific photo (any of the primary/gallery images) to print
-- on the formal quote, independent of which photo customers see as the storefront
-- primary image. NULL means "keep following the primary image automatically".
-- Keep this migration safe for an existing database and existing rows.
ALTER TABLE public.basin_prices
  ADD COLUMN IF NOT EXISTS quote_image_url text;
