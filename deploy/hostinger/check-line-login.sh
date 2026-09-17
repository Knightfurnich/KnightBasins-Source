#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://knightbasins.srv1964473.hstgr.cloud}"
API_BASE="${BASE_URL%/}/api"
EXPECTED_CALLBACK="https://knightbasins.srv1964473.hstgr.cloud/api/auth/line/callback"

health_body="$(mktemp)"
login_headers="$(mktemp)"
trap 'rm -f "$health_body" "$login_headers"' EXIT

health_status="$(curl --silent --show-error --output "$health_body" --write-out '%{http_code}' "$API_BASE/healthz")"
if [[ "$health_status" != "200" ]]; then
  echo "LINE health check failed (HTTP $health_status)." >&2
  # Never print the response body: deployment logs must not become a
  # credential or channel-identifier sink if the health payload changes.
  exit 1
fi

node - "$health_body" <<'NODE'
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const lineLogin = body.lineLogin;

if (
  body.status !== "ok" ||
  !lineLogin ||
  lineLogin.ready !== true ||
  lineLogin.callbackUrlValid !== true ||
  lineLogin.callbackEnvironment !== "production"
) {
  console.error("LINE health diagnostics did not report a ready production configuration.");
  process.exit(1);
}
NODE

login_status="$(curl --silent --show-error --dump-header "$login_headers" --output /dev/null --write-out '%{http_code}' "$API_BASE/auth/line/login")"
if [[ "$login_status" != "302" ]]; then
  echo "LINE login redirect check failed (HTTP $login_status)." >&2
  exit 1
fi

login_location="$(awk 'tolower($0) ~ /^location:/ { line = $0; sub(/\r$/, "", line); sub(/^[^:]*:[[:space:]]*/, "", line); print line; exit }' "$login_headers")"
expected_redirect_uri="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$EXPECTED_CALLBACK")"
if [[ "$login_location" != https://access.line.me/oauth2/v2.1/authorize\?* ]] ||
  [[ "$login_location" != *"redirect_uri=$expected_redirect_uri"* ]]; then
  echo "LINE login redirect did not contain the expected callback URL." >&2
  exit 1
fi

callback_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$API_BASE/auth/line/callback")"
if [[ "$callback_status" != "400" ]]; then
  echo "LINE callback route check failed (expected HTTP 400 without OAuth state, got $callback_status)." >&2
  exit 1
fi

echo "LINE production configuration, login redirect, and callback route are valid."