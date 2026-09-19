#!/usr/bin/env bash
# Deployed on the VPS at /docker/backups/backup-postgres.sh and run daily by
# root's crontab: 0 19 * * * /docker/backups/backup-postgres.sh >> /var/log/knight-backup.log 2>&1
# (19:00 UTC = 02:00 Asia/Bangkok)
#
# This backs up the ENTIRE Postgres instance (pg_dumpall) inside the shared
# knightdesign-db container -- both the knight_basins database and Knight
# Design's own database -- not just Knight Basins alone. It authenticates as
# $POSTGRES_USER using that container's own environment, so no password is
# read, printed, or stored by this script or by cron.
#
# Output is a plain-SQL dump (gzip-compressed), restorable with:
#   gunzip -c postgres-all-<timestamp>.sql.gz | docker exec -i knightdesign-db \
#     sh -c 'psql -U "$POSTGRES_USER"'
# This is NOT a pg_dump --format=custom archive, so pg_restore does not apply
# here -- see the note in restore-check.sh.
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/docker/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-knightdesign-db}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/postgres-all-$timestamp.sql.gz"
partial="$target.part"
trap 'rm -f "$partial"' EXIT

docker exec "$DB_CONTAINER" sh -c 'pg_dumpall -U "$POSTGRES_USER"' | gzip > "$partial"
mv "$partial" "$target"

find "$BACKUP_DIR" -type f -name 'postgres-all-*.sql.gz' \
  -mtime "+$RETENTION_DAYS" -delete

echo "Created $target"
