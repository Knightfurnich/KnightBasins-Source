#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v psql >/dev/null 2>&1; then
  if [[ "${KNIGHT_BASINS_MIGRATION_IN_CONTAINER:-0}" != "1" ]] && command -v docker >/dev/null 2>&1; then
    api_container="${KNIGHT_BASINS_API_CONTAINER:-knightbasins-api}"
    api_env_file="${KNIGHT_BASINS_API_ENV_FILE:-/etc/knight-basins/api.env}"
    migration_image="${KNIGHT_BASINS_MIGRATION_IMAGE:-postgres:16-alpine}"
    if [[ ! -r "$api_env_file" ]]; then
      echo "Set KNIGHT_BASINS_API_ENV_FILE to the Docker API env file readable by the deploy user" >&2
      exit 1
    fi
    if ! docker inspect "$api_container" >/dev/null 2>&1; then
      echo "Docker API container '$api_container' was not found" >&2
      exit 1
    fi
    exec docker run --rm \
      --network "container:${api_container}" \
      --env-file "$api_env_file" \
      --env KNIGHT_BASINS_MIGRATION_IN_CONTAINER=1 \
      --env KNIGHT_BASINS_MIGRATIONS_DIR=/migrations \
      --volume "$script_dir:/migration-source:ro" \
      --volume "$script_dir/migrations:/migrations:ro" \
      "$migration_image" \
      bash /migration-source/migrate.sh
  fi
  echo "psql is required to apply Knight Basins migrations" >&2
  exit 1
fi

: "${DATABASE_URL:?DATABASE_URL must be set by the systemd EnvironmentFile}"

migrations_dir="${KNIGHT_BASINS_MIGRATIONS_DIR:-$script_dir/migrations}"
ledger_table="public.knight_basins_schema_migrations"

psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 <<SQL
CREATE TABLE IF NOT EXISTS ${ledger_table} (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
migration_files=("$migrations_dir"/*.sql)

for migration_file in "${migration_files[@]}"; do
  migration_id="$(basename "$migration_file" .sql)"
  if [[ ! "$migration_id" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "Invalid migration filename: $(basename "$migration_file")" >&2
    exit 1
  fi

  applied="$(
    psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --tuples-only --no-align \
      --command="SELECT 1 FROM ${ledger_table} WHERE migration_id = '${migration_id}' LIMIT 1"
  )"
  if [[ "$applied" == "1" ]]; then
    continue
  fi

  echo "Applying Knight Basins migration ${migration_id}"
  {
    echo "BEGIN;"
    cat "$migration_file"
    printf "\nINSERT INTO %s (migration_id) VALUES ('%s');\n" "$ledger_table" "$migration_id"
    echo "COMMIT;"
  } | psql "$DATABASE_URL" --set=ON_ERROR_STOP=1
done