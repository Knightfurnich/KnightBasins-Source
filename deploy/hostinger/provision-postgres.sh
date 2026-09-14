#!/usr/bin/env bash
set -Eeuo pipefail

# Run this on the VPS as a sudo-capable account. The password is supplied only
# through the environment so it never needs to be committed or pasted into a
# SQL command in shell history.

DB_NAME="${KNIGHT_BASINS_DB_NAME:-knight_basins}"
DB_USER="${KNIGHT_BASINS_DB_USER:-knight_basins_app}"
DB_PASSWORD="${KNIGHT_BASINS_DB_PASSWORD:-}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Set KNIGHT_BASINS_DB_PASSWORD in the VPS shell before running this script." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1 || ! command -v sudo >/dev/null 2>&1; then
  echo "This script requires both psql and sudo." >&2
  exit 1
fi

psql_as_postgres() {
  sudo -u postgres psql "$@"
}

# psql's :'name' form safely quotes values before they are used in dynamic
# statements. Identifiers are fixed by the environment variables above and are
# quoted with format('%I', ...).
psql_as_postgres \
  --dbname=postgres \
  --set=ON_ERROR_STOP=1 \
  --set=db_name="$DB_NAME" \
  --set=db_user="$DB_USER" \
  --set=db_password="$DB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'db_user',
  :'db_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'db_user', :'db_password')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name')
\gexec
SQL

psql_as_postgres \
  --dbname=postgres \
  --set=ON_ERROR_STOP=1 \
  --set=db_name="$DB_NAME" \
  --set=db_user="$DB_USER" <<'SQL'
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'db_user') \gexec
SQL

psql_as_postgres \
  --dbname="$DB_NAME" \
  --set=ON_ERROR_STOP=1 \
  --set=db_user="$DB_USER" <<'SQL'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO :"db_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"db_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO :"db_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"db_user" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"db_user";
SQL

echo "Provisioned PostgreSQL database '$DB_NAME' and restricted role '$DB_USER'."
echo "Use a localhost-only DATABASE_URL for the API and run the schema push next."