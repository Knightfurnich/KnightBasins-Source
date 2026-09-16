#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://knightbasins.srv1964473.hstgr.cloud}"
BASE_URL="${BASE_URL%/}"

index_body="$(mktemp)"
index_headers="$(mktemp)"
asset_body="$(mktemp)"
asset_headers="$(mktemp)"
trap 'rm -f "$index_body" "$index_headers" "$asset_body" "$asset_headers"' EXIT

index_status="$(
  curl --silent --show-error \
    --dump-header "$index_headers" \
    --output "$index_body" \
    --write-out '%{http_code}' \
    "$BASE_URL/"
)"

if [[ "$index_status" != "200" ]]; then
  echo "Web root check failed (HTTP $index_status)." >&2
  exit 1
fi

mapfile -t js_assets < <(
  python3 - "$index_body" <<'PY'
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class ScriptSourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return

        source = dict(attrs).get("src")
        if source and re.search(r"\.m?js(?:[?#]|$)", source, re.IGNORECASE):
            if source not in self.sources:
                self.sources.append(source)


parser = ScriptSourceParser()
parser.feed(Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace"))

if not parser.sources:
    print(
        "No root JavaScript asset was found in the production index.",
        file=sys.stderr,
    )
    sys.exit(1)

print("\n".join(parser.sources))
PY
)

if [[ "${#js_assets[@]}" -eq 0 ]]; then
  echo "Web asset check found no JavaScript assets." >&2
  exit 1
fi

for asset_path in "${js_assets[@]}"; do
  if [[ "$asset_path" != /assets/* ]]; then
    echo "JavaScript asset check failed for $asset_path: path must start with /assets/." >&2
    exit 1
  fi

  asset_status="$(
    curl --silent --show-error \
      --dump-header "$asset_headers" \
      --output "$asset_body" \
      --write-out '%{http_code}' \
      "$BASE_URL$asset_path"
  )"

  if [[ "$asset_status" != "200" ]]; then
    echo "JavaScript asset check failed for $asset_path (HTTP $asset_status)." >&2
    exit 1
  fi

  content_type="$(
    awk 'tolower($0) ~ /^content-type:/ {
      value = $0
      sub(/^[^:]*:[[:space:]]*/, "", value)
      sub(/\r$/, "", value)
      print tolower(value)
      exit
    }' "$asset_headers"
  )"

  case "$content_type" in
    application/javascript*|text/javascript*|application/x-javascript*) ;;
    *)
      echo "JavaScript asset check failed for $asset_path: expected JavaScript Content-Type, got ${content_type:-<missing>}." >&2
      exit 1
      ;;
  esac

  if grep -Eiq '<!doctype[[:space:]]+html|<html[[:space:]>]' "$asset_body"; then
    echo "JavaScript asset check failed for $asset_path: response body is HTML, likely an SPA fallback." >&2
    exit 1
  fi

  echo "OK $asset_path (HTTP 200, Content-Type: $content_type)"
done

echo "Web root and JavaScript asset checks passed for $BASE_URL."