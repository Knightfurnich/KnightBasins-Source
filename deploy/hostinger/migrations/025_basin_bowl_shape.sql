-- Migration 025: bowl shape of a basin, editable by the admin (job 445-C, revision 2)
-- Approved by Boss (คุณนพ) on 11 Oct 2026. Additive only: one nullable column, nothing is removed or rewritten.
--   bowl_shape   one of rounded-rectangle | oval | round | rectangle | square | rounded-square (checked by the API)
-- NULL = "not specified": GET /api/catalog then answers from the built-in table, so a card never loses its line.
-- The label shown to customers is built in code from this value; no wording is stored here.
-- The seeds carry the values the built-in table already holds for these three models; each UPDATE only touches a row whose
-- column is still empty, so re-running it, or running it after an admin edit, never overwrites anything.

ALTER TABLE basin_prices ADD COLUMN IF NOT EXISTS bowl_shape varchar(24);

-- KF003: rounded rectangle
UPDATE basin_prices SET bowl_shape = 'rounded-rectangle' WHERE sku = 'KF003' AND bowl_shape IS NULL;

-- KF006: oval
UPDATE basin_prices SET bowl_shape = 'oval' WHERE sku = 'KF006' AND bowl_shape IS NULL;

-- KF025: round (tall pedestal)
UPDATE basin_prices SET bowl_shape = 'round' WHERE sku = 'KF025' AND bowl_shape IS NULL;
