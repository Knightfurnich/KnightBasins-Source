-- Migration 026: move the surveyed bowl shapes of the other 22 models into the database (job 449-C)
-- Approved by Boss (คุณนพ) on 11 Oct 2026. Data only, additive: no table or column changes, nothing is dropped.
-- 025 added basin_prices.bowl_shape and seeded KF003, KF006 and KF025. This file seeds the other 22 surveyed models
-- (25 in all) with exactly the values GET /api/catalog already answered from the built-in table, so what a customer
-- sees is the same before and after. From now on the database is the source of truth: a NULL here means 'not
-- specified' (no line on the card) and nothing falls back to the code. KF007, KF009, KF010 (picture not clear) and
-- KF029, KF030 (not wash basins) are deliberately NOT seeded and stay NULL.
-- Each UPDATE only touches a row whose column is still empty, so running it again, or after an admin edit or clear,
-- never overwrites anything it should not.

UPDATE basin_prices SET bowl_shape = 'rounded-rectangle' WHERE sku = 'KF001' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rounded-rectangle' WHERE sku = 'KF002' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rounded-rectangle' WHERE sku = 'KF004' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rounded-rectangle' WHERE sku = 'KF005' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'oval' WHERE sku = 'KF008' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF011' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF012' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF013' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF014' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF015' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF016' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF017' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF018' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'square' WHERE sku = 'KF019' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'square' WHERE sku = 'KF020' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'square' WHERE sku = 'KF021' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rounded-square' WHERE sku = 'KF022' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'round' WHERE sku = 'KF023' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'round' WHERE sku = 'KF024' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'round' WHERE sku = 'KF026' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rectangle' WHERE sku = 'KF027' AND bowl_shape IS NULL;
UPDATE basin_prices SET bowl_shape = 'rounded-rectangle' WHERE sku = 'KF028' AND bowl_shape IS NULL;
