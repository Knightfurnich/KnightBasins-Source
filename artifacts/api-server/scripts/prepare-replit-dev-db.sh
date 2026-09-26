#!/usr/bin/env bash
set -euo pipefail

if [[ "${NODE_ENV:-}" != "development" ]]; then
  echo "Refusing to run Replit development migrations outside NODE_ENV=development." >&2
  exit 1
fi

if [[ -z "${REPL_ID:-}" || -z "${REPLIT_DEV_DOMAIN:-}" ]]; then
  echo "Refusing to run Replit development migrations without Replit workspace markers." >&2
  exit 1
fi

: "${DATABASE_URL:?The Replit development database must provide DATABASE_URL.}"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
workspace_root="$(cd -- "$script_dir/../../.." && pwd)"
migration_runner="$workspace_root/deploy/hostinger/migrate.sh"

if [[ ! -f "$migration_runner" ]]; then
  echo "Knight Basins migration runner was not found." >&2
  exit 1
fi

lock_file="${TMPDIR:-/tmp}/knight-basins-dev-migrations-${REPL_ID}.lock"
exec flock --exclusive "$lock_file" bash "$migration_runner"