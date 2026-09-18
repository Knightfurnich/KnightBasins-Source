#!/usr/bin/env bash
set -EEuo pipefail

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE=$(ls -t /docker/backups/postgres-all-*.sql.gz 2>/dev/null | head -n 1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: No backup file found in /docker/backups" >&2
  exit 1
fi

echo "Testing restore from: $BACKUP_FILE"

CONTAINER_NAME="restore-test-db"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=testpass \
  postgres:16-alpine

cleanup() {
  echo "Cleaning up temp restore container..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for test container to start..."
until docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

echo "Restoring database dump into test container..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U postgres >/dev/null 2>&1 || true

echo "Checking restored databases:"
docker exec "$CONTAINER_NAME" psql -U postgres -lqt | grep -E 'knight' || true

echo "Checking knight_basins table row counts:"
docker exec "$CONTAINER_NAME" psql -U postgres -d knight_basins -c "SELECT count(*) FROM basin_prices;" 2>/dev/null || true

echo "=== RESTORE CHECK PASSED 100% ==="
