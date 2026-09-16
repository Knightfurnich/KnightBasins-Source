#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/knight-basins}"
backup_file="${1:-}"

if [[ -z "$backup_file" ]]; then
  backup_file="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'knight-basins-*.dump' -printf '%T@ %p\n' \
    | sort -nr | awk 'NR == 1 { sub(/^[^ ]+ /, ""); print }')"
fi

if [[ -z "$backup_file" || ! -r "$backup_file" ]]; then
  echo "No readable backup archive was found in $BACKUP_DIR." >&2
  exit 1
fi

if ! command -v runuser >/dev/null 2>&1; then
  echo "This script requires runuser." >&2
  exit 1
fi

temp_db="knight_basins_restore_check_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  runuser -u postgres -- dropdb --if-exists "$temp_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

runuser -u postgres -- createdb "$temp_db"
runuser -u postgres -- pg_restore \
  --exit-on-error \
  --no-owner \
  --no-acl \
  --dbname="$temp_db" \
  "$backup_file"

runuser -u postgres -- psql \
  --dbname="$temp_db" \
  --set=ON_ERROR_STOP=1 \
  --command='SELECT count(*) AS basin_rows FROM basin_prices; SELECT count(*) AS installed_stone_rows FROM installed_stone_prices; SELECT count(*) AS sheet_stone_rows FROM sheet_stone_prices;'

echo "Restore check passed for $backup_file"