#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CHECK_SCRIPT="deploy/hostinger/check-upload-files.sh"
UPLOAD_DIR="artifacts/api-server/uploads"
FIXTURE="deploy/hostinger/test-fixtures/runtime-upload-fixture.txt"
TEST_INDEX="$(mktemp)"
HOST_MEDIA=""
TRACKED_UPLOAD=""

cleanup() {
  rm -f "$HOST_MEDIA" "$TRACKED_UPLOAD" "$TEST_INDEX"
}
trap cleanup EXIT

mkdir -p "$UPLOAD_DIR"
HOST_MEDIA="$(mktemp "$UPLOAD_DIR/deployment-host-media-fixture.XXXXXX")"
TRACKED_UPLOAD="$(mktemp "$UPLOAD_DIR/catalog-upload-fixture.XXXXXX")"
cp "$FIXTURE" "$HOST_MEDIA"

clean_output="$(bash "$CHECK_SCRIPT")"
if [[ "$clean_output" != *"Upload release check passed"* ]]; then
  printf 'Expected an untracked deployment-host upload to pass, got:\n%s\n' \
    "$clean_output" >&2
  exit 1
fi

rm -f "$TEST_INDEX"
GIT_INDEX_FILE="$TEST_INDEX" git read-tree HEAD
cp "$FIXTURE" "$TRACKED_UPLOAD"
GIT_INDEX_FILE="$TEST_INDEX" git add -f -- "$TRACKED_UPLOAD"

set +e
blocked_output="$(
  GIT_INDEX_FILE="$TEST_INDEX" bash "$CHECK_SCRIPT" 2>&1
)"
blocked_status=$?
set -e

if ((blocked_status == 0)); then
  printf 'Expected a tracked runtime upload to fail the release check.\n' >&2
  exit 1
fi

if [[ "$blocked_output" != *"$TRACKED_UPLOAD"* ]]; then
  printf 'Expected the blocked path in the release-check output, got:\n%s\n' \
    "$blocked_output" >&2
  exit 1
fi

printf '%s\n' 'Upload release guard regression test passed.'