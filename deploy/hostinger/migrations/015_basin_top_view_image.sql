-- Optional Top View image per basin model/color, shown alongside the
-- existing angled product photo (imageUrl) and gallery images.

ALTER TABLE public.basin_prices ADD COLUMN IF NOT EXISTS top_view_image_url text;
