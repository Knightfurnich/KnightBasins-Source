#!/usr/bin/env bash
# Deployed on the VPS at /docker/backups/backup-postgres.sh and run daily by
# root's crontab: 0 19 * * * /docker/backups/backup-postgres.sh >> /var/log/knight-backup.log 2>&1
# (19:00 UTC = 02:00 Asia/Bangkok)
#
# Backs up every Postgres container listed in DB_CONTAINERS (pg_dumpall --
# a full-instance dump -- run once per container). Each container
# authenticates as its own $POSTGRES_USER using that container's own
# environment, so no password is read, printed, or stored by this script or
# by cron.
#
# Since 2026-09-21: knight_basins lives in its own dedicated knightbasins-db
# container (migrated out of the shared knightdesign-db instance), so it is
# backed up separately from knightdesign-db (Knight Design's own database,
# now a decommissioned app, plus a stale copy of knight_basins until that
# old copy is cleaned up as a separate step).
#
# Output is one plain-SQL dump (gzip-compressed) per container. knightdesign-db
# keeps its historical filename (no container name in it) so existing tooling
# that globs postgres-all-*.sql.gz keeps finding it; every other container's
# name is included in its filename to stay distinguishable. Restore with:
#   gunzip -c <file>.sql.gz | docker exec -i <container> sh -c 'psql -U "$POSTGRES_USER"'
# This is NOT a pg_dump --format=custom archive, so pg_restore does not apply
# here -- see the note in restore-check.sh.
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/docker/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
# Space-separated list of containers to back up. Override for a one-off run,
# e.g. DB_CONTAINERS=knightbasins-db bash backup.sh
DB_CONTAINERS="${DB_CONTAINERS:-knightdesign-db knightbasins-db}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  rm -f "$BACKUP_DIR"/*.sql.gz.part
}
trap cleanup EXIT

for container in $DB_CONTAINERS; do
  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "Skipping $container: container not found." >&2
    continue
  fi

  if [[ "$container" == "knightdesign-db" ]]; then
    target="$BACKUP_DIR/postgres-all-$timestamp.sql.gz"
  else
    target="$BACKUP_DIR/postgres-all-$container-$timestamp.sql.gz"
  fi
  partial="$target.part"

  docker exec "$container" sh -c 'pg_dumpall -U "$POSTGRES_USER"' | gzip > "$partial"
  mv "$partial" "$target"
  echo "Created $target"
done

find "$BACKUP_DIR" -type f -name 'postgres-all-*.sql.gz' \
  -mtime "+$RETENTION_DAYS" -delete
