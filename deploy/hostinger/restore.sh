#!/usr/bin/env bash
set -EEuo pipefail

# Emergency Database Restore Script for Knight Basins / Knight Design
# WARNING: This script overwrites the live production database in knightdesign-db!

FORCE_FLAG=""
BACKUP_FILE=""

for arg in "$@"; do
  if [ "$arg" == "--force" ]; then
    FORCE_FLAG="true"
  elif [ -f "$arg" ]; then
    BACKUP_FILE="$arg"
  fi
done

if [ "$FORCE_FLAG" != "true" ]; then
  echo "ERROR: Emergency restore requires --force flag." >&2
  echo "Usage: $0 --force [/path/to/backup.sql.gz]" >&2
  exit 1
fi

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE=$(ls -t /docker/backups/postgres-all-*.sql.gz 2>/dev/null | head -n 1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: No backup file found to restore." >&2
  exit 1
fi

echo "================================================================="
echo "WARNING: EMERGENCY DATABASE RESTORE IN PROGRESS"
echo "Target Container : knightdesign-db"
echo "Source Backup    : $BACKUP_FILE"
echo "================================================================="

# Step 1: Perform immediate safety backup before restoring
echo "Step 1/3: Creating safety pre-restore backup..."
SAFETY_BACKUP="/docker/backups/pre-restore-safety-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker exec knightdesign-db sh -c 'pg_dumpall -U "$POSTGRES_USER"' | gzip > "$SAFETY_BACKUP"
echo "Safety backup created at $SAFETY_BACKUP"

# Step 2: Restore dump
echo "Step 2/3: Restoring database dump into knightdesign-db..."
gunzip -c "$BACKUP_FILE" | docker exec -i knightdesign-db psql -U postgres >/dev/null 2>&1

# Step 3: Restart API containers to reload connections
echo "Step 3/3: Restarting API containers..."
docker restart knightbasins-api knightdesign-api >/dev/null 2>&1 || true

echo "================================================================="
echo "SUCCESS: Emergency database restore completed successfully."
echo "================================================================="
