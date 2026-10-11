-- Migration 025: bowl shape and overflow hole of a basin, editable by the admin (job 445-C)
-- Approved by Boss (คุณนพ) on 11 Oct 2026. Additive only: two nullable columns, nothing is removed or rewritten.
--   bowl_shape         one of rounded-rectangle | oval | round | rectangle | square | rounded-square (checked by the API)
--   bowl_overflow_hole true / false / NULL (NULL = not specified)
-- NULL in bowl_shape = "not specified": GET /api/catalog then answers from the built-in table, so a customer sees the same
-- text before and after this migration. The seeds below carry the same values the built-in table already holds for these
-- three models; each UPDATE only touches a row whose columns are still empty, so re-running it, or running it after an
-- admin edit, never overwrites anything.

ALTER TABLE basin_prices ADD COLUMN IF NOT EXISTS bowl_shape varchar(24);
ALTER TABLE basin_prices ADD COLUMN IF NOT EXISTS bowl_overflow_hole boolean;

-- KF003: rounded-rectangle bowl, no overflow hole
UPDATE basin_prices SET bowl_shape = 'rounded-rectangle', bowl_overflow_hole = false
  WHERE sku = 'KF003' AND bowl_shape IS NULL AND bowl_overflow_hole IS NULL;

-- KF006: oval bowl, overflow hole
UPDATE basin_prices SET bowl_shape = 'oval', bowl_overflow_hole = true
  WHERE sku = 'KF006' AND bowl_shape IS NULL AND bowl_overflow_hole IS NULL;

-- KF025: round bowl (tall pedestal), overflow hole not specified
UPDATE basin_prices SET bowl_shape = 'round'
  WHERE sku = 'KF025' AND bowl_shape IS NULL AND bowl_overflow_hole IS NULL;
