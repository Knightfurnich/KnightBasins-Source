#!/usr/bin/env bash
# Nightly logical backup of the Knight Basins database.
#
# Writes a gzip-compressed pg_dump into /docker/knightbasins/backups/, which the
# api container mounts read-only at /app/backups and serves to an Admin/Owner
# session through GET /api/admin/backup/database-dump. The directory is never
# mounted into the nginx web container, so dumps cannot be fetched by URL.
#
# Installed on the VPS at /docker/knightbasins/backups/knight_db_backup.sh and
# scheduled (02:00 Asia/Bangkok) from root's crontab:
#   0 19 * * * /docker/knightbasins/backups/knight_db_backup.sh >> /var/log/knight_db_backup.log 2>&1
set -euo pipefail

OUT_DIR=${KNIGHT_BASINS_BACKUP_DIR:-/docker/knightbasins/backups}
DB_CONTAINER=${KNIGHT_BASINS_DB_CONTAINER:-knightbasins-db}
DB_USER=${KNIGHT_BASINS_DB_USER:-knight_basins_app}
DB_NAME=${KNIGHT_BASINS_DB_NAME:-knight_basins}
KEEP=${KNIGHT_BASINS_BACKUP_KEEP:-14}

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$OUT_DIR/knight_basins_${STAMP}.sql.gz"

mkdir -p "$OUT_DIR"

# --no-owner/--no-privileges so the dump restores under any role name.
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
  | gzip -9 > "$TARGET"
chmod 600 "$TARGET"

# Row counts sidecar: a restore target can be sanity-checked without opening the dump.
ROWCOUNTS="$OUT_DIR/knight_basins_rowcounts_${STAMP}.txt"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
SELECT relname || chr(9) || n_live_tup FROM pg_stat_user_tables ORDER BY relname;" > "$ROWCOUNTS" || true
chmod 600 "$ROWCOUNTS"

# Retention: keep only the newest $KEEP dumps (and their rowcount sidecars).
ls -1t "$OUT_DIR"/knight_basins_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$OUT_DIR"/knight_basins_rowcounts_*.txt 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "backup written: $TARGET ($(du -h "$TARGET" | cut -f1))"
