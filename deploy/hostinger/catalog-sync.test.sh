#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/catalog-sync.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/knight-basins-catalog-sync-test.XXXXXX")"
PGDATA="$TEST_ROOT/pgdata"
SOCKET_DIR="$TEST_ROOT/socket"
PORT="$((32000 + ($$ % 2000)))"
PROD_DB="catalog_sync_prod_test"
DEV_DB="catalog_sync_dev_test"

cleanup() {
  if [[ -f "$PGDATA/PG_VERSION" ]]; then
    pg_ctl -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

for command_name in initdb pg_ctl createdb dropdb psql; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Catalog sync integration test requires '$command_name'." >&2
    exit 1
  }
done

initdb --no-locale --encoding=UTF8 --auth=trust --username=postgres "$PGDATA" >/dev/null
mkdir -p "$SOCKET_DIR"
pg_ctl -D "$PGDATA" -o "-k $SOCKET_DIR -p $PORT" -w start >/dev/null
createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres "$PROD_DB"
createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres "$DEV_DB"

schema_sql="$TEST_ROOT/schema.sql"
cat >"$schema_sql" <<'SQL'
CREATE TABLE basin_categories (
  id serial PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE basin_prices (
  id serial PRIMARY KEY,
  sku varchar(32) NOT NULL UNIQUE,
  color_code varchar(64) NOT NULL,
  color_name varchar(160) NOT NULL,
  price_thb integer NOT NULL,
  category varchar(80) NOT NULL,
  category_id integer REFERENCES basin_categories(id) ON DELETE SET NULL,
  dimensions varchar(160) NOT NULL,
  basin_dimensions varchar(160),
  bowl_mm varchar(160),
  image_tone varchar(24) NOT NULL,
  image_url text,
  video_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE installed_stone_prices (
  id serial PRIMARY KEY,
  code varchar(64) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  price_per_sqm_thb integer NOT NULL,
  category_id integer,
  tone varchar(24) NOT NULL,
  image_url text,
  aliases text[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sheet_stone_prices (
  id serial PRIMARY KEY,
  code varchar(64) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  base_price_thb integer NOT NULL,
  price_10_plus_thb integer NOT NULL,
  price_50_plus_thb integer NOT NULL,
  tone varchar(24) NOT NULL,
  image_url text,
  aliases text[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SQL
psql -X -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$PROD_DB" -f "$schema_sql" >/dev/null
psql -X -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$DEV_DB" -f "$schema_sql" >/dev/null

prod_seed="$TEST_ROOT/production-seed.sql"
cat >"$prod_seed" <<'SQL'
INSERT INTO basin_categories (name, active, sort_order) VALUES ('counter basin', true, 2);
INSERT INTO basin_prices
  (sku, color_code, color_name, price_thb, category, category_id, dimensions,
   basin_dimensions, bowl_mm, image_tone, image_url, video_url, active, sort_order)
SELECT 'KF001', 'VS311', 'Shine', 19000, 'counter basin', id,
       '600 × 800 × 200 mm', '350 × 500 × 130 mm', NULL, '#dfe4df',
       'https://cdn.example.test/KF001.jpg', '/kb/videos/KF001.mp4', true, 4
FROM basin_categories WHERE name = 'counter basin';
INSERT INTO installed_stone_prices
  (code, name, price_per_sqm_thb, category_id, tone, image_url, aliases, active, sort_order)
VALUES ('ST001', 'River White', 12000, NULL, 'light',
        'https://cdn.example.test/ST001.jpg', ARRAY['River White'], true, 1);
INSERT INTO sheet_stone_prices
  (code, name, base_price_thb, price_10_plus_thb, price_50_plus_thb,
   tone, image_url, aliases, active, sort_order)
VALUES ('SH001', 'Archived Stone', 5000, 4500, 4000, 'dark',
        '/kb/images/SH001.jpg', ARRAY['Archived Stone'], false, 3);
SQL
psql -X -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$PROD_DB" -f "$prod_seed" >/dev/null

dev_seed="$TEST_ROOT/development-seed.sql"
cat >"$dev_seed" <<'SQL'
INSERT INTO basin_categories (name, active, sort_order) VALUES
  ('development-only', true, 9),
  ('counter basin', false, 99);
INSERT INTO basin_prices
  (sku, color_code, color_name, price_thb, category, category_id, dimensions,
   basin_dimensions, bowl_mm, image_tone, image_url, video_url, active, sort_order)
SELECT 'KF001', 'OLD', 'Old Shine', 1, 'counter basin', id,
       'old', NULL, NULL, '#000000', '/old/image.jpg', NULL, true, 99
FROM basin_categories WHERE name = 'counter basin';
INSERT INTO basin_prices
  (sku, color_code, color_name, price_thb, category, dimensions,
   basin_dimensions, bowl_mm, image_tone, active, sort_order)
VALUES ('STALE', 'OLD', 'Stale', 1, 'development-only', 'old',
        NULL, NULL, '#000000', true, 100);
INSERT INTO installed_stone_prices
  (code, name, price_per_sqm_thb, tone, image_url, aliases, active, sort_order)
VALUES ('ST001', 'Old River White', 1, 'dark', '/old/stone.jpg',
        ARRAY['old'], true, 99),
       ('STALE-STONE', 'Stale Stone', 1, 'dark', NULL, ARRAY['stale'], true, 100);
INSERT INTO sheet_stone_prices
  (code, name, base_price_thb, price_10_plus_thb, price_50_plus_thb,
   tone, image_url, aliases, active, sort_order)
VALUES ('SH001', 'Old Archived Stone', 1, 1, 1, 'light', NULL,
        ARRAY['old'], true, 99),
       ('STALE-SHEET', 'Stale Sheet', 1, 1, 1, 'light', NULL,
        ARRAY['stale'], true, 100);
SQL
psql -X -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$DEV_DB" -f "$dev_seed" >/dev/null

export PRODUCTION_DATABASE_URL="postgresql://postgres@/$PROD_DB?host=$SOCKET_DIR&port=$PORT"
export DEVELOPMENT_DATABASE_URL="postgresql://postgres@/$DEV_DB?host=$SOCKET_DIR&port=$PORT"
export CATALOG_SYNC_BACKUP_DIR="$TEST_ROOT/backups"

dry_run_output="$TEST_ROOT/dry-run.txt"
bash "$SYNC_SCRIPT" --dry-run >"$dry_run_output"
grep -q "production_rows.*development_rows" "$dry_run_output"
grep -q "missing_in_development" "$dry_run_output"
grep -q "extra_in_development" "$dry_run_output"
grep -q "changed" "$dry_run_output"

bash "$SYNC_SCRIPT" --apply >"$TEST_ROOT/apply-first.txt"
test "$(find "$TEST_ROOT/backups" -type f -name '*.dump' | wc -l)" -eq 1

psql -X "$DEVELOPMENT_DATABASE_URL" -At -c \
  "SELECT count(*) FROM basin_categories WHERE name = 'development-only';" | grep -qx '0'
psql -X "$DEVELOPMENT_DATABASE_URL" -At -c \
  "SELECT active::text || '|' || image_url FROM sheet_stone_prices WHERE code = 'SH001';" |
  grep -qx 'false|/kb/images/SH001.jpg'
psql -X "$DEVELOPMENT_DATABASE_URL" -At -c \
  "SELECT category_id = (SELECT id FROM basin_categories WHERE name = 'counter basin') FROM basin_prices WHERE sku = 'KF001';" |
  grep -qx 't'

# Applying the same snapshot again must remain clean and create a separate backup.
bash "$SYNC_SCRIPT" --apply >"$TEST_ROOT/apply-second.txt"
test "$(find "$TEST_ROOT/backups" -type f -name '*.dump' | wc -l)" -eq 2
grep -q "Catalog sync applied successfully" "$TEST_ROOT/apply-second.txt"

before_rollback="$(
  psql -X "$DEVELOPMENT_DATABASE_URL" -At -c \
    "SELECT count(*) || '|' || coalesce(string_agg(code, ',' ORDER BY code), '') FROM sheet_stone_prices;"
)"
bash "$SYNC_SCRIPT" --rollback-test >"$TEST_ROOT/rollback.txt"
after_rollback="$(
  psql -X "$DEVELOPMENT_DATABASE_URL" -At -c \
    "SELECT count(*) || '|' || coalesce(string_agg(code, ',' ORDER BY code), '') FROM sheet_stone_prices;"
)"
[[ "$before_rollback" == "$after_rollback" ]]
grep -q "Rollback test passed" "$TEST_ROOT/rollback.txt"

echo "Catalog sync integration test passed."