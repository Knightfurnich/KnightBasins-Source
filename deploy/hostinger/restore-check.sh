#!/usr/bin/env bash
# Verifies that a backup produced by backup.sh (pg_dumpall, plain SQL,
# gzip-compressed) actually restores.
#
# Since 2026-09-21, backup.sh writes one dump per Postgres container --
# knightdesign-db (postgres-all-<timestamp>.sql.gz) and knightbasins-db
# (postgres-all-knightbasins-db-<timestamp>.sql.gz). With no argument, this
# script checks the newest backup of EACH family, not just the single newest
# file overall, so a new knightbasins-db backup can't silently go unchecked
# just because knightdesign-db's dump happened to be a few seconds newer (or
# vice versa). Pass a specific archive path to check only that one file.
#
# This does NOT use pg_restore or a host-level `postgres` OS user -- these
# are plain-SQL pg_dumpall archives, and Postgres does not run on the host at
# all (it runs inside the source containers). Instead this starts a
# disposable postgres:16-alpine container with no volumes per archive,
# restores the dump into it with psql, verifies the knight_basins tables,
# then destroys the container. It never touches any live database container
# or its data.
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/docker/backups}"
explicit_file="${1:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "This script requires docker." >&2
  exit 1
fi

check_one() {
  local backup_file="$1"

  if [[ ! -r "$backup_file" ]]; then
    echo "Cannot read $backup_file" >&2
    return 1
  fi

  local restore_container="knight_basins_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
  # Only used inside the disposable container for this run; discarded with it.
  local restore_password
  restore_password="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"

  local cleanup_one
  cleanup_one() { docker rm -f "$restore_container" >/dev/null 2>&1 || true; }
  trap cleanup_one RETURN

  echo "Starting a disposable postgres:16-alpine container..."
  docker run -d --rm \
    --name "$restore_container" \
    -e POSTGRES_PASSWORD="$restore_password" \
    postgres:16-alpine >/dev/null

  echo "Waiting for it to accept connections..."
  local ready=0
  for _ in $(seq 1 30); do
    if docker exec "$restore_container" pg_isready -U postgres >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    echo "Disposable Postgres container never became ready." >&2
    return 1
  fi

  echo "Restoring $backup_file into it..."
  gunzip -c "$backup_file" | docker exec -i "$restore_container" psql -U postgres -v ON_ERROR_STOP=1 -q >/dev/null

  echo "Verifying the knight_basins database..."
  docker exec "$restore_container" psql -U postgres --dbname=knight_basins \
    --set=ON_ERROR_STOP=1 \
    --command='SELECT count(*) AS basin_rows FROM basin_prices; SELECT count(*) AS installed_stone_rows FROM installed_stone_prices; SELECT count(*) AS sheet_stone_rows FROM sheet_stone_prices;'

  echo "Restore check passed for $backup_file"
}

if [[ -n "$explicit_file" ]]; then
  check_one "$explicit_file"
  exit 0
fi

# No explicit file: check the newest backup for each known filename family
# separately, so neither container's backup can be skipped by the other's
# timestamp winning a single global "latest" comparison.
found_any=0
for pattern in 'postgres-all-2*.sql.gz' 'postgres-all-knightbasins-db-*.sql.gz'; do
  latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr | awk 'NR == 1 { sub(/^[^ ]+ /, ""); print }')"
  if [[ -n "$latest" ]]; then
    found_any=1
    echo "=== Checking $latest ==="
    check_one "$latest"
  fi
done

if [[ "$found_any" -eq 0 ]]; then
  echo "No readable backup archives found in $BACKUP_DIR (looking for postgres-all-*.sql.gz)." >&2
  exit 1
fi
