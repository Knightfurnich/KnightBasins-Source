#!/usr/bin/env bash
set -Eeuo pipefail

# Copy only the approved catalog tables from Production to Development.
#
# Required environment:
#   PRODUCTION_DATABASE_URL   PostgreSQL URL for the read-only source
#   DEVELOPMENT_DATABASE_URL  PostgreSQL URL for the writable target
#
# Usage:
#   catalog-sync.sh --dry-run       Show counts and row-level differences
#   catalog-sync.sh --apply         Back up Development, then sync in one transaction
#   catalog-sync.sh --rollback-test Back up Development, exercise the transaction,
#                                   and verify that an intentional failure rolls back
#
# The source is snapshotted into JSON Lines before the target session starts.
# This keeps the transfer independent of Production and prevents production IDs
# from being used as Development foreign keys.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODE="dry-run"
BACKUP_DIR="${CATALOG_SYNC_BACKUP_DIR:-/var/backups/knight-basins/catalog-sync}"

usage() {
  cat <<'USAGE'
Usage: catalog-sync.sh [--dry-run|--apply|--rollback-test]

Environment:
  PRODUCTION_DATABASE_URL   Read-only Production PostgreSQL URL
  DEVELOPMENT_DATABASE_URL  Writable Development PostgreSQL URL
  CATALOG_SYNC_BACKUP_DIR   Development backup directory
USAGE
}

while (($# > 0)); do
  case "$1" in
    --dry-run) MODE="dry-run" ;;
    --apply) MODE="apply" ;;
    --rollback-test) MODE="rollback-test" ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command '$1' was not found." >&2
    exit 1
  }
}

require_command psql
if [[ "$MODE" != "dry-run" ]]; then
  require_command pg_dump
  require_command pg_restore
fi

: "${PRODUCTION_DATABASE_URL:?PRODUCTION_DATABASE_URL must be set}"
: "${DEVELOPMENT_DATABASE_URL:?DEVELOPMENT_DATABASE_URL must be set}"

if [[ "$PRODUCTION_DATABASE_URL" == "$DEVELOPMENT_DATABASE_URL" ]]; then
  echo "Production and Development database URLs must be different." >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/knight-basins-catalog-sync.XXXXXX")"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

sql_literal() {
  local value="$1"
  value="${value//\'/\'\'}"
  printf "'%s'" "$value"
}

prod_snapshot_sql="$TEMP_DIR/snapshot-production.sql"
cat >"$prod_snapshot_sql" <<SQL
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
\copy (SELECT row_to_json(source_row)::text FROM public.basin_categories AS source_row ORDER BY source_row.name, source_row.id) TO $(sql_literal "$TEMP_DIR/basin_categories.jsonl") WITH (FORMAT text)
\copy (SELECT row_to_json(source_row)::text FROM public.basin_prices AS source_row ORDER BY source_row.sku, source_row.id) TO $(sql_literal "$TEMP_DIR/basin_prices.jsonl") WITH (FORMAT text)
\copy (SELECT row_to_json(source_row)::text FROM public.installed_stone_prices AS source_row ORDER BY source_row.code, source_row.id) TO $(sql_literal "$TEMP_DIR/installed_stone_prices.jsonl") WITH (FORMAT text)
\copy (SELECT row_to_json(source_row)::text FROM public.sheet_stone_prices AS source_row ORDER BY source_row.code, source_row.id) TO $(sql_literal "$TEMP_DIR/sheet_stone_prices.jsonl") WITH (FORMAT text)
COMMIT;
SQL

echo "Reading the approved catalog tables from Production..."
psql "$PRODUCTION_DATABASE_URL" --no-password --no-psqlrc --quiet \
  --set=ON_ERROR_STOP=1 --file="$prod_snapshot_sql"

backup_development() {
  local timestamp partial target
  install -d -m 0700 "$BACKUP_DIR"
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  partial="$(mktemp "$BACKUP_DIR/knight-basins-development-catalog-$timestamp.XXXXXX.dump.part")"
  target="${partial%.part}"
  rm -f "$partial"

  cleanup_backup_partial() {
    rm -f "$partial"
  }
  trap cleanup_backup_partial RETURN

  echo "Creating and validating the Development backup..."
  # Keep the pre-write archive within the same approved boundary. A full
  # database dump would read unrelated customer tables.
  pg_dump --format=custom --no-owner --no-acl \
    --table=public.basin_categories \
    --table=public.basin_prices \
    --table=public.installed_stone_prices \
    --table=public.sheet_stone_prices \
    --file="$partial" "$DEVELOPMENT_DATABASE_URL"
  pg_restore --list "$partial" >/dev/null
  mv "$partial" "$target"
  chmod 0600 "$target"
  echo "Development backup: $target"
}

dev_sql="$TEMP_DIR/sync-development.sql"
cat >"$dev_sql" <<SQL
\set ON_ERROR_STOP on
\set VERBOSITY verbose

CREATE TEMP TABLE catalog_sync_raw_basin_categories (data jsonb NOT NULL);
CREATE TEMP TABLE catalog_sync_raw_basin_prices (data jsonb NOT NULL);
CREATE TEMP TABLE catalog_sync_raw_installed_stone_prices (data jsonb NOT NULL);
CREATE TEMP TABLE catalog_sync_raw_sheet_stone_prices (data jsonb NOT NULL);
\copy catalog_sync_raw_basin_categories(data) FROM $(sql_literal "$TEMP_DIR/basin_categories.jsonl") WITH (FORMAT text)
\copy catalog_sync_raw_basin_prices(data) FROM $(sql_literal "$TEMP_DIR/basin_prices.jsonl") WITH (FORMAT text)
\copy catalog_sync_raw_installed_stone_prices(data) FROM $(sql_literal "$TEMP_DIR/installed_stone_prices.jsonl") WITH (FORMAT text)
\copy catalog_sync_raw_sheet_stone_prices(data) FROM $(sql_literal "$TEMP_DIR/sheet_stone_prices.jsonl") WITH (FORMAT text)

CREATE TEMP TABLE catalog_sync_prod_basin_categories AS
  SELECT * FROM public.basin_categories WITH NO DATA;
CREATE TEMP TABLE catalog_sync_prod_basin_prices AS
  SELECT * FROM public.basin_prices WITH NO DATA;
CREATE TEMP TABLE catalog_sync_prod_installed_stone_prices AS
  SELECT * FROM public.installed_stone_prices WITH NO DATA;
CREATE TEMP TABLE catalog_sync_prod_sheet_stone_prices AS
  SELECT * FROM public.sheet_stone_prices WITH NO DATA;

INSERT INTO catalog_sync_prod_basin_categories
  SELECT (jsonb_populate_record(NULL::public.basin_categories, data)).*
  FROM catalog_sync_raw_basin_categories;
INSERT INTO catalog_sync_prod_basin_prices
  SELECT (jsonb_populate_record(NULL::public.basin_prices, data)).*
  FROM catalog_sync_raw_basin_prices;
INSERT INTO catalog_sync_prod_installed_stone_prices
  SELECT (jsonb_populate_record(NULL::public.installed_stone_prices, data)).*
  FROM catalog_sync_raw_installed_stone_prices;
INSERT INTO catalog_sync_prod_sheet_stone_prices
  SELECT (jsonb_populate_record(NULL::public.sheet_stone_prices, data)).*
  FROM catalog_sync_raw_sheet_stone_prices;

\echo ''
\echo 'Production media URL validation'
SELECT source_table, stable_key, media_column, media_url
FROM (
  SELECT 'basin_prices'::text AS source_table, sku::text AS stable_key,
         'image_url'::text AS media_column, image_url AS media_url
  FROM catalog_sync_prod_basin_prices
  UNION ALL
  SELECT 'basin_prices', sku::text, 'video_url', video_url
  FROM catalog_sync_prod_basin_prices
  UNION ALL
  SELECT 'installed_stone_prices', code::text, 'image_url', image_url
  FROM catalog_sync_prod_installed_stone_prices
  UNION ALL
  SELECT 'sheet_stone_prices', code::text, 'image_url', image_url
  FROM catalog_sync_prod_sheet_stone_prices
) media
WHERE media_url IS NOT NULL
  AND (btrim(media_url) = '' OR media_url !~ '^(https?://|/)')
ORDER BY source_table, stable_key, media_column;

DO \$\$
DECLARE
  duplicate_count bigint;
  invalid_media_count bigint;
  missing_category_count bigint;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT name FROM catalog_sync_prod_basin_categories GROUP BY name HAVING count(*) > 1
    UNION ALL
    SELECT sku FROM catalog_sync_prod_basin_prices GROUP BY sku HAVING count(*) > 1
    UNION ALL
    SELECT code FROM catalog_sync_prod_installed_stone_prices GROUP BY code HAVING count(*) > 1
    UNION ALL
    SELECT code FROM catalog_sync_prod_sheet_stone_prices GROUP BY code HAVING count(*) > 1
  ) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Production contains % duplicate stable catalog keys', duplicate_count;
  END IF;

  SELECT count(*) INTO invalid_media_count
  FROM (
    SELECT image_url AS media_url FROM catalog_sync_prod_basin_prices
    UNION ALL
    SELECT video_url FROM catalog_sync_prod_basin_prices
    UNION ALL
    SELECT image_url FROM catalog_sync_prod_installed_stone_prices
    UNION ALL
    SELECT image_url FROM catalog_sync_prod_sheet_stone_prices
  ) media
  WHERE media_url IS NOT NULL
    AND (btrim(media_url) = '' OR media_url !~ '^(https?://|/)');
  IF invalid_media_count > 0 THEN
    RAISE EXCEPTION 'Production contains % invalid catalog media URLs', invalid_media_count;
  END IF;

  SELECT count(*) INTO missing_category_count
  FROM catalog_sync_prod_basin_prices basin
  LEFT JOIN catalog_sync_prod_basin_categories category ON category.name = basin.category
  WHERE basin.category_id IS NOT NULL AND category.name IS NULL;
  IF missing_category_count > 0 THEN
    RAISE EXCEPTION 'Production contains % basin rows whose category name cannot be mapped', missing_category_count;
  END IF;
END
\$\$;

\echo ''
\echo 'Catalog row counts and differences'

\echo 'basin_categories'
WITH production AS (
  SELECT name AS stable_key,
         to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
  FROM catalog_sync_prod_basin_categories row
), development AS (
  SELECT name AS stable_key,
         to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
  FROM public.basin_categories row
), joined AS (
  SELECT production.stable_key AS production_key,
         development.stable_key AS development_key,
         production.payload AS production_payload,
         development.payload AS development_payload
  FROM production FULL OUTER JOIN development USING (stable_key)
)
SELECT 'basin_categories' AS table_name,
       count(production_key) AS production_rows,
       count(development_key) AS development_rows,
       count(*) FILTER (WHERE development_key IS NULL) AS missing_in_development,
       count(*) FILTER (WHERE production_key IS NULL) AS extra_in_development,
       count(*) FILTER (WHERE production_key IS NOT NULL AND development_key IS NOT NULL
                         AND production_payload <> development_payload) AS changed_rows
FROM joined;
SELECT 'basin_categories' AS table_name, difference, stable_key,
       production_payload, development_payload
FROM (
  SELECT CASE
    WHEN development_key IS NULL THEN 'missing_in_development'
    WHEN production_key IS NULL THEN 'extra_in_development'
    ELSE 'changed'
  END AS difference,
  coalesce(production_key, development_key) AS stable_key,
  production_payload, development_payload
  FROM (
    SELECT production.stable_key AS production_key,
           development.stable_key AS development_key,
           production.payload AS production_payload,
           development.payload AS development_payload
    FROM (
      SELECT name AS stable_key,
             to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
      FROM catalog_sync_prod_basin_categories row
    ) production
    FULL OUTER JOIN (
      SELECT name AS stable_key,
             to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
      FROM public.basin_categories row
    ) development USING (stable_key)
  ) joined
) differences
WHERE difference = 'missing_in_development'
   OR difference = 'extra_in_development'
   OR production_payload <> development_payload
ORDER BY difference, stable_key;

\echo 'basin_prices'
WITH production AS (
  SELECT sku AS stable_key,
         to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
  FROM catalog_sync_prod_basin_prices row
), development AS (
  SELECT sku AS stable_key,
         to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
  FROM public.basin_prices row
), joined AS (
  SELECT production.stable_key AS production_key,
         development.stable_key AS development_key,
         production.payload AS production_payload,
         development.payload AS development_payload
  FROM production FULL OUTER JOIN development USING (stable_key)
)
SELECT 'basin_prices' AS table_name,
       count(production_key) AS production_rows,
       count(development_key) AS development_rows,
       count(*) FILTER (WHERE development_key IS NULL) AS missing_in_development,
       count(*) FILTER (WHERE production_key IS NULL) AS extra_in_development,
       count(*) FILTER (WHERE production_key IS NOT NULL AND development_key IS NOT NULL
                         AND production_payload <> development_payload) AS changed_rows
FROM joined;
SELECT 'basin_prices' AS table_name, difference, stable_key,
       production_payload, development_payload
FROM (
  SELECT CASE
    WHEN development_key IS NULL THEN 'missing_in_development'
    WHEN production_key IS NULL THEN 'extra_in_development'
    ELSE 'changed'
  END AS difference,
  coalesce(production_key, development_key) AS stable_key,
  production_payload, development_payload
  FROM (
    SELECT production.stable_key AS production_key,
           development.stable_key AS development_key,
           production.payload AS production_payload,
           development.payload AS development_payload
    FROM (
      SELECT sku AS stable_key,
             to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
      FROM catalog_sync_prod_basin_prices row
    ) production
    FULL OUTER JOIN (
      SELECT sku AS stable_key,
             to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
      FROM public.basin_prices row
    ) development USING (stable_key)
  ) joined
) differences
WHERE difference = 'missing_in_development'
   OR difference = 'extra_in_development'
   OR production_payload <> development_payload
ORDER BY difference, stable_key;

\echo 'installed_stone_prices'
WITH production AS (
  SELECT code AS stable_key,
         to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
  FROM catalog_sync_prod_installed_stone_prices row
), development AS (
  SELECT code AS stable_key,
         to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
  FROM public.installed_stone_prices row
), joined AS (
  SELECT production.stable_key AS production_key,
         development.stable_key AS development_key,
         production.payload AS production_payload,
         development.payload AS development_payload
  FROM production FULL OUTER JOIN development USING (stable_key)
)
SELECT 'installed_stone_prices' AS table_name,
       count(production_key) AS production_rows,
       count(development_key) AS development_rows,
       count(*) FILTER (WHERE development_key IS NULL) AS missing_in_development,
       count(*) FILTER (WHERE production_key IS NULL) AS extra_in_development,
       count(*) FILTER (WHERE production_key IS NOT NULL AND development_key IS NOT NULL
                         AND production_payload <> development_payload) AS changed_rows
FROM joined;
SELECT 'installed_stone_prices' AS table_name, difference, stable_key,
       production_payload, development_payload
FROM (
  SELECT CASE
    WHEN development_key IS NULL THEN 'missing_in_development'
    WHEN production_key IS NULL THEN 'extra_in_development'
    ELSE 'changed'
  END AS difference,
  coalesce(production_key, development_key) AS stable_key,
  production_payload, development_payload
  FROM (
    SELECT production.stable_key AS production_key,
           development.stable_key AS development_key,
           production.payload AS production_payload,
           development.payload AS development_payload
    FROM (
      SELECT code AS stable_key,
             to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
      FROM catalog_sync_prod_installed_stone_prices row
    ) production
    FULL OUTER JOIN (
      SELECT code AS stable_key,
             to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
      FROM public.installed_stone_prices row
    ) development USING (stable_key)
  ) joined
) differences
WHERE difference = 'missing_in_development'
   OR difference = 'extra_in_development'
   OR production_payload <> development_payload
ORDER BY difference, stable_key;

\echo 'sheet_stone_prices'
WITH production AS (
  SELECT code AS stable_key,
         to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
  FROM catalog_sync_prod_sheet_stone_prices row
), development AS (
  SELECT code AS stable_key,
         to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
  FROM public.sheet_stone_prices row
), joined AS (
  SELECT production.stable_key AS production_key,
         development.stable_key AS development_key,
         production.payload AS production_payload,
         development.payload AS development_payload
  FROM production FULL OUTER JOIN development USING (stable_key)
)
SELECT 'sheet_stone_prices' AS table_name,
       count(production_key) AS production_rows,
       count(development_key) AS development_rows,
       count(*) FILTER (WHERE development_key IS NULL) AS missing_in_development,
       count(*) FILTER (WHERE production_key IS NULL) AS extra_in_development,
       count(*) FILTER (WHERE production_key IS NOT NULL AND development_key IS NOT NULL
                         AND production_payload <> development_payload) AS changed_rows
FROM joined;
SELECT 'sheet_stone_prices' AS table_name, difference, stable_key,
       production_payload, development_payload
FROM (
  SELECT CASE
    WHEN development_key IS NULL THEN 'missing_in_development'
    WHEN production_key IS NULL THEN 'extra_in_development'
    ELSE 'changed'
  END AS difference,
  coalesce(production_key, development_key) AS stable_key,
  production_payload, development_payload
  FROM (
    SELECT production.stable_key AS production_key,
           development.stable_key AS development_key,
           production.payload AS production_payload,
           development.payload AS development_payload
    FROM (
      SELECT code AS stable_key,
             to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
      FROM catalog_sync_prod_sheet_stone_prices row
    ) production
    FULL OUTER JOIN (
      SELECT code AS stable_key,
             to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
      FROM public.sheet_stone_prices row
    ) development USING (stable_key)
  ) joined
) differences
WHERE difference = 'missing_in_development'
   OR difference = 'extra_in_development'
   OR production_payload <> development_payload
ORDER BY difference, stable_key;
SQL

if [[ "$MODE" == "apply" || "$MODE" == "rollback-test" ]]; then
  cat >>"$dev_sql" <<'SQL'

BEGIN;

-- Delete by stable keys first so stale rows cannot remain in Development.
DELETE FROM public.basin_prices target
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_sync_prod_basin_prices source WHERE source.sku = target.sku
);
DELETE FROM public.installed_stone_prices target
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_sync_prod_installed_stone_prices source WHERE source.code = target.code
);
DELETE FROM public.sheet_stone_prices target
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_sync_prod_sheet_stone_prices source WHERE source.code = target.code
);
DELETE FROM public.basin_categories target
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_sync_prod_basin_categories source WHERE source.name = target.name
);

INSERT INTO public.basin_categories
  (name, active, sort_order, created_at, updated_at)
SELECT name, active, sort_order, created_at, updated_at
FROM catalog_sync_prod_basin_categories
ON CONFLICT (name) DO UPDATE SET
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.basin_prices
  (sku, color_code, color_name, price_thb, category, category_id, dimensions,
   basin_dimensions, bowl_mm, image_tone, image_url, video_url, active,
   sort_order, created_at, updated_at)
SELECT source.sku, source.color_code, source.color_name, source.price_thb,
       source.category,
       CASE WHEN source.category_id IS NULL THEN NULL ELSE category.id END,
       source.dimensions, source.basin_dimensions, source.bowl_mm,
       source.image_tone, source.image_url, source.video_url, source.active,
       source.sort_order, source.created_at, source.updated_at
FROM catalog_sync_prod_basin_prices source
LEFT JOIN public.basin_categories category ON category.name = source.category
ON CONFLICT (sku) DO UPDATE SET
  color_code = EXCLUDED.color_code,
  color_name = EXCLUDED.color_name,
  price_thb = EXCLUDED.price_thb,
  category = EXCLUDED.category,
  category_id = EXCLUDED.category_id,
  dimensions = EXCLUDED.dimensions,
  basin_dimensions = EXCLUDED.basin_dimensions,
  bowl_mm = EXCLUDED.bowl_mm,
  image_tone = EXCLUDED.image_tone,
  image_url = EXCLUDED.image_url,
  video_url = EXCLUDED.video_url,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.installed_stone_prices
  (code, name, price_per_sqm_thb, tone, image_url, aliases,
   active, sort_order, created_at, updated_at)
SELECT code, name, price_per_sqm_thb, tone, image_url, aliases,
       active, sort_order, created_at, updated_at
FROM catalog_sync_prod_installed_stone_prices
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_per_sqm_thb = EXCLUDED.price_per_sqm_thb,
  tone = EXCLUDED.tone,
  image_url = EXCLUDED.image_url,
  aliases = EXCLUDED.aliases,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.sheet_stone_prices
  (code, name, base_price_thb, price_10_plus_thb, price_50_plus_thb,
   tone, image_url, aliases, active, sort_order, created_at, updated_at)
SELECT code, name, base_price_thb, price_10_plus_thb, price_50_plus_thb,
       tone, image_url, aliases, active, sort_order, created_at, updated_at
FROM catalog_sync_prod_sheet_stone_prices
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  base_price_thb = EXCLUDED.base_price_thb,
  price_10_plus_thb = EXCLUDED.price_10_plus_thb,
  price_50_plus_thb = EXCLUDED.price_50_plus_thb,
  tone = EXCLUDED.tone,
  image_url = EXCLUDED.image_url,
  aliases = EXCLUDED.aliases,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
SQL

  cat >>"$dev_sql" <<'SQL'

DO $$
DECLARE
  difference_count bigint;
BEGIN
  WITH basin_categories_production AS (
    SELECT name AS stable_key,
           to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
    FROM catalog_sync_prod_basin_categories row
  ), basin_categories_development AS (
    SELECT name AS stable_key,
           to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
    FROM public.basin_categories row
  ), basin_production AS (
    SELECT sku AS stable_key,
           to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
    FROM catalog_sync_prod_basin_prices row
  ), basin_development AS (
    SELECT sku AS stable_key,
           to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
    FROM public.basin_prices row
  ), installed_production AS (
    SELECT code AS stable_key,
           to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
    FROM catalog_sync_prod_installed_stone_prices row
  ), installed_development AS (
    SELECT code AS stable_key,
           to_jsonb(row) - 'id' - 'category_id' - 'created_at' - 'updated_at' AS payload
    FROM public.installed_stone_prices row
  ), sheet_production AS (
    SELECT code AS stable_key,
           to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
    FROM catalog_sync_prod_sheet_stone_prices row
  ), sheet_development AS (
    SELECT code AS stable_key,
           to_jsonb(row) - 'id' - 'created_at' - 'updated_at' AS payload
    FROM public.sheet_stone_prices row
  )
  SELECT count(*) INTO difference_count
  FROM (
    SELECT p.stable_key
    FROM basin_categories_production p
    FULL OUTER JOIN basin_categories_development d USING (stable_key)
    WHERE p.stable_key IS NULL OR d.stable_key IS NULL OR p.payload <> d.payload
    UNION ALL
    SELECT p.stable_key
    FROM basin_production p
    FULL OUTER JOIN basin_development d USING (stable_key)
    WHERE p.stable_key IS NULL OR d.stable_key IS NULL OR p.payload <> d.payload
    UNION ALL
    SELECT p.stable_key
    FROM installed_production p
    FULL OUTER JOIN installed_development d USING (stable_key)
    WHERE p.stable_key IS NULL OR d.stable_key IS NULL OR p.payload <> d.payload
    UNION ALL
    SELECT p.stable_key
    FROM sheet_production p
    FULL OUTER JOIN sheet_development d USING (stable_key)
    WHERE p.stable_key IS NULL OR d.stable_key IS NULL OR p.payload <> d.payload
  ) differences;
  IF difference_count > 0 THEN
    RAISE EXCEPTION 'Catalog sync did not produce a clean match: % differences', difference_count;
  END IF;
END
$$;
SQL

  if [[ "$MODE" == "rollback-test" ]]; then
    cat >>"$dev_sql" <<'SQL'
\echo 'Forcing an error to verify the catalog transaction rolls back...'
DO $$ BEGIN
  RAISE EXCEPTION 'catalog-sync rollback test';
END $$;
SQL
  else
    cat >>"$dev_sql" <<'SQL'
COMMIT;
SQL
  fi
fi

catalog_hash() {
  psql "$DEVELOPMENT_DATABASE_URL" --no-password --no-psqlrc --quiet --tuples-only --no-align \
    --set=ON_ERROR_STOP=1 --command="
      SELECT md5(coalesce(string_agg(row_to_json(row)::text, '|' ORDER BY row.name, row.id), ''))
      FROM public.basin_categories row;
      SELECT md5(coalesce(string_agg(row_to_json(row)::text, '|' ORDER BY row.sku, row.id), ''))
      FROM public.basin_prices row;
      SELECT md5(coalesce(string_agg(row_to_json(row)::text, '|' ORDER BY row.code, row.id), ''))
      FROM public.installed_stone_prices row;
      SELECT md5(coalesce(string_agg(row_to_json(row)::text, '|' ORDER BY row.code, row.id), ''))
      FROM public.sheet_stone_prices row;
    "
}

if [[ "$MODE" == "dry-run" ]]; then
  psql "$DEVELOPMENT_DATABASE_URL" --no-password --no-psqlrc --set=ON_ERROR_STOP=1 --file="$dev_sql"
  echo "Dry run complete. No Development rows were written."
  exit 0
fi

backup_development

if [[ "$MODE" == "rollback-test" ]]; then
  before_hash="$(catalog_hash)"
  set +e
  psql "$DEVELOPMENT_DATABASE_URL" --no-password --no-psqlrc --file="$dev_sql"
  transaction_status=$?
  set -e
  after_hash="$(catalog_hash)"

  if ((transaction_status == 0)); then
    echo "Rollback test failed: the intentional transaction error did not fail." >&2
    exit 1
  fi
  if [[ "$before_hash" != "$after_hash" ]]; then
    echo "Rollback test failed: Development catalog changed after rollback." >&2
    exit 1
  fi
  echo "Rollback test passed. Development catalog is unchanged."
  exit 0
fi

psql "$DEVELOPMENT_DATABASE_URL" --no-password --no-psqlrc --file="$dev_sql"
echo "Catalog sync applied successfully. The transaction committed only the approved catalog tables."