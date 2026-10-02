-- 019_stone_image_roles.sql
-- Add gallery_image_urls, quote_image_url, and slab_image_url to both
-- installed_stone_prices and sheet_stone_prices tables.
-- Safe migration: uses IF NOT EXISTS, keeps existing data intact.

ALTER TABLE public.installed_stone_prices
  ADD COLUMN IF NOT EXISTS gallery_image_urls text[] DEFAULT ARRAY[]::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS quote_image_url text,
  ADD COLUMN IF NOT EXISTS slab_image_url text;

ALTER TABLE public.sheet_stone_prices
  ADD COLUMN IF NOT EXISTS gallery_image_urls text[] DEFAULT ARRAY[]::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS quote_image_url text,
  ADD COLUMN IF NOT EXISTS slab_image_url text;
