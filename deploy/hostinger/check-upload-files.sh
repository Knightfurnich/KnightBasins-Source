#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

tracked_uploads=()
while IFS= read -r upload_path; do
  [[ -e "$upload_path" ]] && tracked_uploads+=("$upload_path")
done < <(git ls-files -- 'artifacts/api-server/uploads/*')

if ((${#tracked_uploads[@]} > 0)); then
  printf 'Release blocked: unexpected tracked files under artifacts/api-server/uploads/:\n' >&2
  printf '  %s\n' "${tracked_uploads[@]}" >&2
  printf '%s\n' 'Runtime uploads belong on the deployment host, not in the repository.' >&2
  exit 1
fi

printf '%s\n' 'Upload release check passed: no tracked runtime uploads.'