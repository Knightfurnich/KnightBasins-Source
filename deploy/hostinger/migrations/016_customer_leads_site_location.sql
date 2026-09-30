-- Verified site coordinates for a lead, resolved from whatever Google Maps
-- link format the sales team pasted (short link, place path, data param,
-- search query, or raw coordinates) via resolveMapsLink(). Nullable additions
-- only -- existing rows/columns are untouched.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS site_lat double precision,
  ADD COLUMN IF NOT EXISTS site_lng double precision,
  ADD COLUMN IF NOT EXISTS site_maps_url varchar(512);
