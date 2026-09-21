# Deploy Knight Basins to the shared Hostinger VPS

This deployment contains a Vite React storefront plus an Express API and PostgreSQL-backed administration area. It runs as two Docker containers (`knightbasins-api`, `knightbasins-web`) on the same VPS as Knight Design, sharing that VPS's Traefik reverse proxy and its `knightdesign-db` Postgres container (separate database, separate credentials) without sharing a process or document root.

## 1. Deployment is automatic via GitHub Actions

Pushing to `main` on `Knightfurnich/KnightBasins-Source` triggers `.github/workflows/deploy.yml`, which:

1. Builds the storefront (`artifacts/knight-basins`) and the API (`artifacts/api-server`).
2. Copies the built files over SCP to `/docker/knightbasins/web-dist/` and `/docker/knightbasins/api-dist/` on the VPS (`72.62.79.84`) using the `VPS_SSH_KEY` repository secret.
3. Restarts the containers: `docker restart knightbasins-api knightbasins-web`.

There is no manual rsync/systemd step for a normal release — pushing to `main` is the deploy for **application code**. The sections below are for the one-time VPS setup and for operators who need to work on the VPS directly.

### `deploy/hostinger/` itself is never auto-synced

`deploy.yml` only ever touches `web-dist/` and `api-dist/`. It does **not** copy this `deploy/hostinger/` folder — `migrate.sh`, `backup.sh`, `restore-check.sh`, `provision-postgres.sh`, the `check-*.sh` gates, or this README — to the VPS. The copy that runs on the VPS (`/docker/knightbasins/deploy/hostinger/`) only changes when an operator copies it there by hand, so it can silently drift out of sync with what is committed here (this happened for real: the VPS copy sat stale from the initial 2026-09-14 setup for a week, including a `migrate.sh` with a dead default path and a tampered `restore-check.sh` that always printed success). After changing any file in this folder, sync it to the VPS yourself:

```bash
scp deploy/hostinger/<file> root@72.62.79.84:/docker/knightbasins/deploy/hostinger/<file>
ssh root@72.62.79.84 "chmod 755 /docker/knightbasins/deploy/hostinger/<file>"  # scripts only, not README.md
```

On Windows, extract the file from the git blob first (`git show HEAD:deploy/hostinger/<file>`) rather than scp-ing the working-tree copy directly — `core.autocrlf` can silently turn `\n` into `\r\n`, and a script with `\r` before `pipefail` fails with `set: pipefail: invalid option name` on the VPS's bash.

### The `VPS_SSH_KEY` deploy secret

`VPS_SSH_KEY` is a dedicated ed25519 keypair (comment `github-actions-deploy@knightbasins`) whose public half lives in `root@72.62.79.84`'s `/root/.ssh/authorized_keys`; the private half is stored only as the GitHub Actions secret. If the deploy workflow fails at the SCP/SSH steps with `ssh: no key found` or `ssh: handshake failed: unable to authenticate`, the secret value is missing, truncated, or was pasted with the wrong line endings — regenerate it rather than debugging the existing value:

```bash
ssh-keygen -t ed25519 -f knightbasins_deploy_key -N "" -C "github-actions-deploy@knightbasins"
ssh root@72.62.79.84 "cat >> /root/.ssh/authorized_keys" < knightbasins_deploy_key.pub
gh secret set VPS_SSH_KEY --repo Knightfurnich/KnightBasins-Source < knightbasins_deploy_key
```

Then re-run the failed workflow (`gh run rerun <run-id>`) to confirm it now reaches the VPS. Never commit the private half of this keypair; store it outside this repository (e.g. alongside the other production secrets already kept out of Git).

## 2. VPS layout

Everything for this app lives under `/docker/knightbasins/` on the VPS:

```text
/docker/knightbasins/
├── docker-compose.yml   # matches deploy/hostinger/docker-compose.yml in this repo
├── nginx.conf           # matches deploy/hostinger/nginx.conf in this repo
├── .env                 # real secrets; never committed (see below)
├── api-dist/            # built by CI, mounted read-only into the api container
├── web-dist/            # built by CI, mounted read-only into the web container
└── uploads/              # runtime-uploaded catalog/sketch media (see cleanup below)
```

`docker-compose.yml` and `nginx.conf` in this repo are copies of what actually runs — keep them in sync if you change the VPS versions. The `web` container's nginx proxies `/api/` to the `api` container over the `hermes-agent-2xwn_default` Docker network (an external network shared with the Hermes Agent stack) and falls back to `index.html` for client-side routes such as `/stone` and `/quote`. TLS and the public hostname (`knightbasins.srv1964473.hstgr.cloud`) are handled entirely by Traefik via the labels on the `web` service — this repo's nginx config only listens on plain port 80.

To bring the stack up or recreate it after an `.env` change:

```bash
cd /docker/knightbasins
docker compose up -d --force-recreate api web
```

## 3. Database

`knight_basins` is a separate database inside the shared `knightdesign-db` Postgres 16 container (not a dedicated container of its own — this saves VPS resources). Provision the database and a non-superuser app role once, from the VPS:

```bash
export KNIGHT_BASINS_DB_PASSWORD='choose-a-long-random-password'
bash deploy/hostinger/provision-postgres.sh
unset KNIGHT_BASINS_DB_PASSWORD
```

The script creates `knight_basins` and `knight_basins_app` by default, disallows superuser/role/database creation privileges, removes the public database and schema grants, and grants the app role only the permissions needed by Drizzle and the API. Override the names with `KNIGHT_BASINS_DB_NAME` and `KNIGHT_BASINS_DB_USER` if needed.

### `.env`

Create `/docker/knightbasins/.env` (referenced by `docker-compose.yml`'s `env_file:`, readable only by root — never commit this file):

```bash
DATABASE_URL=postgresql://knight_basins_app:URL_ENCODED_PASSWORD@knightdesign-db:5432/knight_basins
SESSION_SECRET=use-a-long-random-secret
ADMIN_PASSWORD=use-a-strong-admin-password
PORT=8080
NODE_ENV=production
LINE_CHANNEL_ID=your-line-channel-id
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CALLBACK_URL=https://knightbasins.srv1964473.hstgr.cloud/api/auth/line/callback
PUBLIC_UPLOAD_ORIGIN=https://knightbasins.srv1964473.hstgr.cloud/api/uploads
PUBLIC_APP_ORIGIN=https://knightbasins.srv1964473.hstgr.cloud
# Optional sales notification channel for submitted quotes/sketches.
# Omit both to degrade gracefully ("saved, but not notified") instead of failing.
NOTIFY_CHANNEL=telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_SALES_CHAT_ID=your-telegram-chat-id
# Optional: SlipOK-verified payment slip upload on the saved quote page.
# Sign up at slipok.com, link the receiving bank account (Krungsri
# 574-1-18925-4), and take the API key + branch ID from there. Omit both
# to degrade gracefully (upload is saved but SlipOK verification is
# skipped and reported as unconfigured) instead of failing.
SLIPOK_API_KEY=your-slipok-api-key
SLIPOK_BRANCH_ID=your-slipok-branch-id
# Optional: routes KnightSupport chat questions the built-in keyword matcher
# can't answer to the Hermes agent that already runs Knight Furnich's LINE
# bot, for logged-in (LINE) customers only. Passing the customer's LINE user
# id as `user` keeps the conversation continuous with their LINE DM history.
# Omit to degrade gracefully (keeps the existing keyword-only fallback reply).
HERMES_API_URL=https://api.srv1964473.hstgr.cloud
HERMES_API_KEY=your-hermes-api-server-key
```

`DATABASE_URL` uses the Docker network hostname `knightdesign-db`, not `127.0.0.1` or `localhost` — the API and the database are different containers on the same Docker network. URL-encode any reserved characters in the password.

### Applying schema migrations

Run the migration helper from the VPS before recreating the API container. It does not require `psql` on the host — when missing, it automatically runs inside a temporary `postgres:16-alpine` container on the API container's network namespace:

```bash
export KNIGHT_BASINS_API_CONTAINER=knightbasins-api
export KNIGHT_BASINS_API_ENV_FILE=/docker/knightbasins/.env
bash /docker/knightbasins/deploy/hostinger/migrate.sh
unset KNIGHT_BASINS_API_CONTAINER KNIGHT_BASINS_API_ENV_FILE
```

It applies pending files from `deploy/hostinger/migrations/` in filename order and records completed files in `public.knight_basins_schema_migrations`. Future schema changes must add one new, independently idempotent `.sql` file under `deploy/hostinger/migrations/`; never edit an already-applied migration.

A new migration file must reach both places, and neither happens automatically: `git add` and commit it to this repo (`deploy.yml` does not run migrations or commit anything for you — see "`deploy/hostinger/` itself is never auto-synced" above), and copy it to `/docker/knightbasins/deploy/hostinger/migrations/` on the VPS before running `migrate.sh`. A migration applied on the VPS but never committed is invisible to everyone else and at risk of being lost; a migration committed but never copied to the VPS never runs.

The API seeds all current basin, installed-stone, and sheet-stone catalog rows on first start (idempotent — skips rows that already exist). The seed source is `artifacts/knight-basins/src/data/catalog.ts`, so a code change to that file does **not** retroactively update rows already seeded into a live database — fix already-seeded rows through the `/admin` panel (or a migration) instead. After starting the API, `/api/catalog` is the read-only confirmation that the seed completed.

### Uploaded product-photo cleanup

By default, every successful image upload is retained for at least 24 hours. This gives an administrator time to save an edit or recover from a cancelled edit. The authenticated cleanup route then removes only generated `catalog-*` files older than the retention period that are not referenced by any basin, installed-stone, or sheet-stone row. It never removes central/static catalog media or a file still referenced by a catalog row.

Run the cleanup once a day from an operator machine or a protected scheduler. Keep the admin session cookie in a temporary file and remove it after the run:

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

Set `UPLOAD_RETENTION_HOURS` in the API environment to change the minimum retention period; invalid values and values below one hour use the 24-hour default. Do not run cleanup by deleting files directly: the route checks all three catalog tables before removing anything.

### Production-to-Development catalog sync

The maintained catalog sync reads only the four approved catalog tables: `basin_categories`, `basin_prices`, `installed_stone_prices`, and `sheet_stone_prices`. It does not read or write leads, accounts, quotes, or sessions. The pre-write archive is also limited to those four tables.

Set separate PostgreSQL URLs in the operator environment. Do not put these URLs in a committed file:

```bash
export PRODUCTION_DATABASE_URL='postgresql://...'
export DEVELOPMENT_DATABASE_URL='postgresql://...'
export CATALOG_SYNC_BACKUP_DIR=/docker/backups/catalog-sync
```

Always inspect the dry run first. It prints row counts and row-level differences matched by category name, basin SKU, or stone code:

```bash
bash deploy/hostinger/catalog-sync.sh --dry-run
```

After approving the differences, apply the sync. The command creates and validates a restrictive, catalog-only Development backup before opening one transaction. It includes inactive sheet stones, maps basin category IDs by category name, preserves Production media URLs, removes stale catalog rows, and checks that the committed state has no remaining differences:

```bash
bash deploy/hostinger/catalog-sync.sh --apply
```

The operator flow has an explicit rollback check. It performs the same transaction against Development, forces an error, and verifies that the catalog is unchanged:

```bash
bash deploy/hostinger/catalog-sync.sh --rollback-test
```

Run the isolated regression test from the repository root before changing the operator command:

```bash
bash deploy/hostinger/catalog-sync.test.sh
```

## 4. Backups

A daily cron job on the VPS host (root's crontab, **not** a systemd timer) runs `/docker/backups/backup-postgres.sh` — a copy of `deploy/hostinger/backup.sh` in this repo:

```text
0 19 * * * /docker/backups/backup-postgres.sh >> /var/log/knight-backup.log 2>&1
```

(19:00 UTC = 02:00 Asia/Bangkok.) It runs `pg_dumpall` inside the shared `knightdesign-db` container, authenticating with that container's own `$POSTGRES_USER` environment variable (the password is never read, printed, or stored by the script or by cron), and writes a gzip-compressed **plain-SQL** dump to `/docker/backups/postgres-all-<timestamp>.sql.gz`. This backs up the entire shared Postgres instance — both `knight_basins` and Knight Design's own database — not Knight Basins alone. Backups older than 14 days are deleted automatically.

Restore a backup with:

```bash
gunzip -c /docker/backups/postgres-all-<timestamp>.sql.gz | \
  docker exec -i knightdesign-db sh -c 'psql -U "$POSTGRES_USER"'
```

Verify a backup actually restores with `restore-check.sh`. It never touches the live `knightdesign-db` container: it starts a disposable `postgres:16-alpine` container with no persistent volume, restores the newest (or a given) `postgres-all-*.sql.gz` archive into it with `psql`, checks the three catalog tables in `knight_basins`, then destroys the container:

```bash
bash deploy/hostinger/restore-check.sh
```

Run it after the first backup, whenever the backup script or the shared Postgres container changes, and periodically thereafter — a backup that has never been restore-tested is not a verified backup.

## 5. Release validation gate

Run this as the final validation step after every API deployment, LINE environment change, or nginx/TLS change. This is a release gate, not an optional smoke check:

```bash
set -euo pipefail
BASE_URL=https://knightbasins.srv1964473.hstgr.cloud \
  bash deploy/hostinger/check-line-login.sh
```

The command exits non-zero and must stop the release when production health is degraded, the login endpoint does not return an authorization redirect with the exact production callback, or the callback route is unavailable. Do not append `|| true`, continue after a failure, or mark the release complete until this command succeeds. The check only logs status and fixed diagnostic messages; it does not print the LINE channel ID, channel secret, or response body.

Before publishing a release commit, run the repository upload guard:

```bash
bash deploy/hostinger/check-upload-files.sh
```

It exits non-zero and lists every unexpected tracked path under `artifacts/api-server/uploads/`. Do not bypass the check; remove test fixtures from Git and keep production uploads on the deployment host.

The release-validation workflow (`.github/workflows/release-validation.yml`) runs this guard on pull requests, pushes to `main`, and manual dispatch before a release can proceed. Its regression test also confirms that an untracked deployment-host upload is allowed while a tracked upload fails and reports its path:

```bash
bash deploy/hostinger/check-upload-files.test.sh
```

Run the web asset gate after a deploy. It fetches `/`, extracts the JavaScript URL with Python 3's standard library, then requires a `/assets/` path, HTTP 200, a JavaScript content type, and a non-HTML response body. This catches both a real 404 and the more subtle case where an SPA fallback returns `index.html` with HTTP 200. The checker requires only `bash`, `curl`, and `python3`; it does not require Node.js:

```bash
BASE_URL=https://knightbasins.srv1964473.hstgr.cloud \
  bash deploy/hostinger/check-web-assets.sh
```

The command exits non-zero on a missing asset, an HTML fallback, or a non-JavaScript `Content-Type`. Run it before the final production smoke test.

Set `BASE_URL` when validating a different public endpoint that is configured to use the same production callback:

```bash
BASE_URL=https://YOUR_PUBLIC_HTTPS_HOST \
  bash deploy/hostinger/check-line-login.sh
```

## Notes

- This app has its own Docker containers, its own database, and its own Traefik router rule — it does not share a process with Knight Design, only the VPS, the Traefik instance, and the Postgres server (as separate databases).
- Do not stop or replace the Knight Design containers (`knightdesign-web`, `knightdesign-api`, `knightdesign-db`) while working on Knight Basins — `knightdesign-db` is a shared dependency.
- The API server is required for current catalog prices and `/admin`.
- Keep `/docker/knightbasins/.env` outside the repository.
- `deploy/hostinger/knight-basins-api.service`, `knight-basins-backup.service`, and `knight-basins-backup.timer` (systemd units) and the old host-level nginx `sites-available` config **no longer exist in this repo** — an earlier version of this deployment ran on bare systemd/nginx instead of Docker + Traefik; they were removed once the Docker Compose setup became the real, actually-running deployment, to avoid anyone following stale instructions.
- Do not put VPS passwords, private keys, or database credentials in this repository or in chat.
