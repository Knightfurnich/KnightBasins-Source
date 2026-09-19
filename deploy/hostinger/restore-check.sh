#!/usr/bin/env bash
# Verifies that a backup produced by backup.sh (pg_dumpall, plain SQL,
# gzip-compressed) actually restores.
#
# Unlike the old version of this script, this does NOT use pg_restore or a
# host-level `postgres` OS user -- backup.sh no longer produces a
# pg_dump --format=custom archive, and Postgres does not run on the host at
# all (it runs inside the knightdesign-db container). Instead this starts a
# disposable postgres:16-alpine container with no volumes, restores the
# dump into it with psql, verifies the knight_basins tables, then destroys
# the container. It never touches the live knightdesign-db container or its
# data.
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/docker/backups}"
backup_file="${1:-}"

if [[ -z "$backup_file" ]]; then
  backup_file="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'postgres-all-*.sql.gz' -printf '%T@ %p\n' \
    | sort -nr | awk 'NR == 1 { sub(/^[^ ]+ /, ""); print }')"
fi

if [[ -z "$backup_file" || ! -r "$backup_file" ]]; then
  echo "No readable backup archive was found in $BACKUP_DIR (looking for postgres-all-*.sql.gz)." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "This script requires docker." >&2
  exit 1
fi

restore_container="knight_basins_restore_check_$(date -u +%Y%m%d%H%M%S)"
# Only used inside the disposable container for this run; discarded with it.
restore_password="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"

cleanup() {
  docker rm -f "$restore_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting a disposable postgres:16-alpine container..."
docker run -d --rm \
  --name "$restore_container" \
  -e POSTGRES_PASSWORD="$restore_password" \
  postgres:16-alpine >/dev/null

echo "Waiting for it to accept connections..."
ready=0
for _ in $(seq 1 30); do
  if docker exec "$restore_container" pg_isready -U postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "Disposable Postgres container never became ready." >&2
  exit 1
fi

echo "Restoring $backup_file into it..."
gunzip -c "$backup_file" | docker exec -i "$restore_container" psql -U postgres -v ON_ERROR_STOP=1 -q >/dev/null

echo "Verifying the knight_basins database..."
docker exec "$restore_container" psql -U postgres --dbname=knight_basins \
  --set=ON_ERROR_STOP=1 \
  --command='SELECT count(*) AS basin_rows FROM basin_prices; SELECT count(*) AS installed_stone_rows FROM installed_stone_prices; SELECT count(*) AS sheet_stone_rows FROM sheet_stone_prices;'

echo "Restore check passed for $backup_file"
