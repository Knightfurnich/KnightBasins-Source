#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="${ENV_FILE:-/etc/knight-basins/api.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/knight-basins}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Cannot read $ENV_FILE" >&2
  exit 1
fi

# The env file is root-controlled and contains shell-compatible KEY=value
# entries. Do not use this with an untrusted file.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is missing from $ENV_FILE" >&2
  exit 1
fi

install -d -m 0700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/knight-basins-$timestamp.dump"
partial="$target.part"
trap 'rm -f "$partial"' EXIT

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$partial" \
  "$DATABASE_URL"

# Validate the archive before making it visible as a completed backup.
pg_restore --list "$partial" >/dev/null
mv "$partial" "$target"
chmod 0600 "$target"

find "$BACKUP_DIR" -type f -name 'knight-basins-*.dump' \
  -mtime "+$RETENTION_DAYS" -delete

echo "Created and validated $target"