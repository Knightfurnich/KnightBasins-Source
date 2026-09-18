# Deploy Knight Basins to the shared Hostinger VPS

This deployment contains a Vite React storefront plus an Express API and PostgreSQL-backed administration area. It can live on the same VPS as Knight Design without sharing its process, database, or document root.

## 1. Build the production files

Run from the repository root:

```bash
pnpm install --frozen-lockfile
PORT=22731 BASE_PATH=/ pnpm --filter @workspace/knight-basins run build
pnpm --filter @workspace/api-server run build
```

The storefront build is guarded for the Hostinger document root. Production
must use `BASE_PATH=/` (or leave `BASE_PATH` unset). The build also inspects
the generated `dist/public/index.html` and fails unless every JS/CSS reference
starts with `/assets/`.

To demonstrate the guard, this command must fail before emitting a usable
production build:

```bash
PORT=22731 BASE_PATH=/knight-basins/ \
  pnpm --filter @workspace/knight-basins run build
# Error: [production-build] BASE_PATH must be "/" or unset ...
```

The normal production build must pass:

```bash
PORT=22731 BASE_PATH=/ \
  pnpm --filter @workspace/knight-basins run build
```

The deployable files will be in:

```text
artifacts/knight-basins/dist/public/
artifacts/api-server/dist/
```

Catalog and sketch uploads are runtime media stored in the API upload directory
on the deployment host. They are not release assets and must never be committed
under `artifacts/api-server/uploads/`. The browser upload test removes files it
creates after each run, and the release check below reports any tracked upload
path before it can be published.

The API starts only after it has applied its idempotent catalog seed. The seed
uses the catalog source in `artifacts/knight-basins/src/data/catalog.ts`, so the
release and the database must come from the same commit.

## 2. Copy the release to the VPS

Create a separate document root. Do not copy over the Knight Design directory:

```bash
sudo mkdir -p /var/www/knight-basins
sudo chown -R "$USER":"$USER" /var/www/knight-basins
```

From the project machine, copy the generated storefront, API bundle, and
deployment helpers. The API bundle is self-contained. The deployment helpers
include a PostgreSQL-only migration runner, so the VPS does not need Node,
pnpm, or a source checkout to apply schema changes.

```bash
rsync -avz --delete artifacts/knight-basins/dist/public/ \
  YOUR_VPS_USER@YOUR_VPS_HOST:/var/www/knight-basins/

ssh YOUR_VPS_USER@YOUR_VPS_HOST \
  'sudo mkdir -p /opt/knight-basins/artifacts/api-server/dist /opt/knight-basins/deploy/hostinger'
rsync -avz --delete artifacts/api-server/dist/ \
  YOUR_VPS_USER@YOUR_VPS_HOST:/opt/knight-basins/artifacts/api-server/dist/
rsync -avz deploy/hostinger/ \
  YOUR_VPS_USER@YOUR_VPS_HOST:/opt/knight-basins/deploy/hostinger/
```

Do not copy `.env` files or credentials. The systemd unit runs
`deploy/hostinger/migrate.sh` as an `ExecStartPre` step before every API start
or restart. It applies pending files from
`deploy/hostinger/migrations/` in filename order and records completed files in
`public.knight_basins_schema_migrations`. A migration failure prevents the API
from starting with an incomplete schema.

For the Docker Compose deployment, run the same helper from the VPS host before
recreating the API container. When `psql` is not installed on the host, the
helper automatically uses a temporary PostgreSQL client container in the
`knightbasins-api` network namespace:

```bash
export KNIGHT_BASINS_API_CONTAINER=knightbasins-api
export KNIGHT_BASINS_API_ENV_FILE=/docker/knightbasins/.env
bash /docker/knightbasins/deploy/hostinger/migrate.sh
unset KNIGHT_BASINS_API_CONTAINER KNIGHT_BASINS_API_ENV_FILE
```

Run this before `docker compose up -d --force-recreate api web`. The migration
container is removed automatically and never stores credentials in the
repository.

## 3. Add the Nginx site

Copy `knightbasins.srv1964473.hstgr.cloud.nginx.conf` to:

```text
/etc/nginx/sites-available/knightbasins.srv1964473.hstgr.cloud
```

Enable it alongside the existing Knight Design site:

```bash
sudo ln -s /etc/nginx/sites-available/knightbasins.srv1964473.hstgr.cloud \
  /etc/nginx/sites-enabled/knightbasins.srv1964473.hstgr.cloud
sudo nginx -t
sudo systemctl reload nginx
```

The `try_files` fallback is required so direct visits to `/stone` and `/quote` work after refresh.

## 4. Configure PostgreSQL and apply the schema

Install PostgreSQL and the client tools if the shared VPS image does not
already include them. Then provision the separate database and non-superuser
role. Run this on the VPS; the password is never stored in the repository:

```bash
export KNIGHT_BASINS_DB_PASSWORD='choose-a-long-random-password'
bash /opt/knight-basins/deploy/hostinger/provision-postgres.sh
unset KNIGHT_BASINS_DB_PASSWORD
```

The script creates `knight_basins` and `knight_basins_app` by default,
disallows superuser/role/database creation privileges, removes the public
database and schema grants, and grants the app role only the permissions
needed by Drizzle and the API. Override the names with
`KNIGHT_BASINS_DB_NAME` and `KNIGHT_BASINS_DB_USER` if needed.

Create `/etc/knight-basins/api.env` with permissions readable only by root and
the service account:

```bash
sudo install -d -m 0750 -o root -g www-data /etc/knight-basins
sudo sh -c 'cat > /etc/knight-basins/api.env' <<'EOF'
DATABASE_URL=postgresql://knight_basins_app:URL_ENCODED_PASSWORD@127.0.0.1:5432/knight_basins
SESSION_SECRET=use-a-long-random-secret
ADMIN_PASSWORD=use-a-strong-admin-password
LINE_CHANNEL_ID=your-line-channel-id
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CALLBACK_URL=https://knightbasins.srv1964473.hstgr.cloud/api/auth/line/callback
# Optional; PUBLIC_UPLOAD_ORIGIN is also accepted for public quote links.
PUBLIC_APP_ORIGIN=https://knightbasins.srv1964473.hstgr.cloud
EOF
sudo chown root:www-data /etc/knight-basins/api.env
sudo chmod 0640 /etc/knight-basins/api.env
```

URL-encode any reserved characters in the database password. After installing
or updating the systemd unit, reload it before the first start or restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart knight-basins-api
```

The restart runs the migration runner before Node starts. The Docker Compose
release command above runs the same migration runner before the containers are
recreated. Future schema changes must add one new, independently idempotent
`.sql` file under `deploy/hostinger/migrations/`; never edit an already-applied
migration.

The API seeds all current basin, installed-stone, and sheet-stone catalog rows
before it starts listening. After starting it, `/api/catalog` is the
read-only confirmation that the seed completed.

The LINE Developers channel must use this exact callback URL:

```text
https://knightbasins.srv1964473.hstgr.cloud/api/auth/line/callback
```

The API reports LINE configuration state at `/api/healthz` without returning
the channel ID or secret. In production, the endpoint returns HTTP 503 until
the channel credentials and exact HTTPS callback URL are configured. For local
development only, use this explicitly allowed callback instead:

```text
http://localhost:5000/api/auth/line/callback
```

Do not use the local callback in the production environment.

### Uploaded product-photo cleanup

By default, every successful image upload is retained for at least 24 hours.
This gives an administrator time to save an edit or recover from a cancelled
edit. The authenticated cleanup route then removes only generated `catalog-*`
files older than the retention period that are not referenced by any basin,
installed-stone, or sheet-stone row. It never removes central/static catalog
media or a file still referenced by a catalog row.

Run the cleanup once a day from an operator machine or a protected scheduler.
Keep the admin session cookie in a temporary file and remove it after the run:

```bash
set -euo pipefail
BASE_URL=https://knightbasins.srv1964473.hstgr.cloud
COOKIE_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE"' EXIT

curl --fail --silent --show-error \
  -c "$COOKIE_FILE" \
  -H 'content-type: application/json' \
  --data "{\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/admin/session" >/dev/null

curl --fail --silent --show-error \
  -b "$COOKIE_FILE" \
  -X POST \
  "$BASE_URL/api/admin/uploads/cleanup"
printf '\n'
```

Set `UPLOAD_RETENTION_HOURS` in the API environment to change the minimum
retention period; invalid values and values below one hour use the 24-hour
default. Do not run cleanup by deleting files directly: the route checks all
three catalog tables before removing anything.

### Production-to-Development catalog sync

The maintained catalog sync reads only the four approved catalog tables:
`basin_categories`, `basin_prices`, `installed_stone_prices`, and
`sheet_stone_prices`. It does not read or write leads, accounts, quotes, or
sessions. The pre-write archive is also limited to those four tables.

Set separate PostgreSQL URLs in the operator environment. Do not put these
URLs in a committed file:

```bash
export PRODUCTION_DATABASE_URL='postgresql://...'
export DEVELOPMENT_DATABASE_URL='postgresql://...'
export CATALOG_SYNC_BACKUP_DIR=/var/backups/knight-basins/catalog-sync
```

Always inspect the dry run first. It prints row counts and row-level
differences matched by category name, basin SKU, or stone code:

```bash
bash deploy/hostinger/catalog-sync.sh --dry-run
```

After approving the differences, apply the sync. The command creates and
validates a restrictive, catalog-only Development backup before opening one
transaction. It includes inactive sheet stones, maps basin category IDs by
category name, preserves Production media URLs, removes stale catalog rows,
and checks that the committed state has no remaining differences:

```bash
bash deploy/hostinger/catalog-sync.sh --apply
```

The operator flow has an explicit rollback check. It performs the same
transaction against Development, forces an error, and verifies that the
catalog is unchanged:

```bash
bash deploy/hostinger/catalog-sync.sh --rollback-test
```

Run the isolated regression test from the repository root before changing the
operator command:

```bash
bash deploy/hostinger/catalog-sync.test.sh
```

## 5. Install and verify the API service

```bash
sudo mkdir -p /etc/knight-basins
sudo cp deploy/hostinger/knight-basins-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now knight-basins-api
sudo systemctl status knight-basins-api
curl http://127.0.0.1:8080/api/healthz
curl http://127.0.0.1:8080/api/catalog
```

The Nginx configuration proxies `/api/` to this service on localhost port 8080.

## 6. Schedule backups and perform a restore check

The backup service stores PostgreSQL custom-format archives protected by
restrictive filesystem permissions under `/var/backups/knight-basins`,
validates each archive before retaining it, and keeps 14 days by default. If
the VPS requires encryption at rest, place the backup directory on the
provider's encrypted volume or add host-managed encryption; the script does
not claim to encrypt database contents.

```bash
sudo install -d -m 0700 /var/backups/knight-basins
sudo cp deploy/hostinger/knight-basins-backup.service /etc/systemd/system/
sudo cp deploy/hostinger/knight-basins-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now knight-basins-backup.timer
sudo systemctl start knight-basins-backup.service
sudo systemctl list-timers knight-basins-backup.timer
sudo bash /opt/knight-basins/deploy/hostinger/restore-check.sh
```

`restore-check.sh` restores the newest archive into a temporary local
database, checks all three catalog tables, and drops the temporary database
when it exits. Run it after the first backup and whenever the backup or
PostgreSQL setup changes.

## 7. Point DNS and enable HTTPS

Create an `A` record:

```text
knightbasins.srv1964473.hstgr.cloud -> YOUR_VPS_IP
```

After DNS resolves, install the certificate without changing the Knight Design server block:

```bash
sudo certbot --nginx -d knightbasins.srv1964473.hstgr.cloud
```

Confirm renewal:

```bash
sudo certbot renew --dry-run
```

Confirm the public endpoints after DNS and TLS are active:

```bash
curl --fail https://knightbasins.srv1964473.hstgr.cloud/api/healthz
curl --fail https://knightbasins.srv1964473.hstgr.cloud/api/catalog
```

## 8. Run the release validation gate

Run this as the final validation step after every API deployment, LINE
environment change, or Nginx/TLS change. This is a release gate, not an
optional smoke check:

```bash
set -euo pipefail
BASE_URL=https://knightbasins.srv1964473.hstgr.cloud \
  bash deploy/hostinger/check-line-login.sh
```

The command exits non-zero and must stop the release when production health is
degraded, the login endpoint does not return an authorization redirect with the
exact production callback, or the callback route is unavailable. Do not append
`|| true`, continue after a failure, or mark the release complete until this
command succeeds. The check only logs status and fixed diagnostic messages; it
does not print the LINE channel ID, channel secret, or response body.

Before publishing a release commit, run the repository upload guard:

```bash
bash deploy/hostinger/check-upload-files.sh
```

It exits non-zero and lists every unexpected tracked path under
`artifacts/api-server/uploads/`. Do not bypass the check; remove test fixtures
from Git and keep production uploads on the deployment host.

The release-validation workflow runs this guard on pull requests, pushes to
`main`, and manual dispatch before a release can proceed. Its regression test
also confirms that an untracked deployment-host upload is allowed while a
tracked upload fails and reports its path:

```bash
bash deploy/hostinger/check-upload-files.test.sh
```

Run the web asset gate after copying the storefront and reloading Nginx. It
fetches `/`, extracts the JavaScript URL with Python 3's standard library, then
requires a `/assets/` path, HTTP 200, a JavaScript content type, and a non-HTML
response body. This catches both a real 404 and the more subtle case where an
SPA fallback returns `index.html` with HTTP 200. The checker requires only
`bash`, `curl`, and `python3`; it does not require Node.js:

```bash
BASE_URL=https://knightbasins.srv1964473.hstgr.cloud \
  bash deploy/hostinger/check-web-assets.sh
```

The command exits non-zero on a missing asset, an HTML fallback, or a
non-JavaScript `Content-Type`. Run it before the final production smoke test.

Set `BASE_URL` when validating a different public endpoint that is configured
to use the same production callback:

```bash
BASE_URL=https://YOUR_PUBLIC_HTTPS_HOST \
  bash deploy/hostinger/check-line-login.sh
```

## Notes

- This site uses its own Nginx `server_name` and `/var/www/knight-basins` root.
- Do not stop or replace the existing Knight Design process.
- The API server is required for current catalog prices and `/admin`.
- Keep `/etc/knight-basins/api.env` outside the repository and back up the PostgreSQL database regularly.
- Keep PostgreSQL listening on localhost unless the VPS has a documented need
  for remote database access. Verify with
  `sudo -u postgres psql -Atc 'SHOW listen_addresses'`.
- If the VPS uses a Node installation outside `/usr/bin/node`, update
  `ExecStart` in the systemd unit to that absolute Node path; do not use an
  interactive shell or an NVM-dependent command in systemd.
- Do not put VPS passwords, private keys, or database credentials in this repository or in chat.