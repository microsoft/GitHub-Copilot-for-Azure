#!/usr/bin/env bash
#
# Runs concurrent live workflow-fixture provisioning processes.
#
# Exit codes:
#   0 - every concurrent run succeeded
#   1 - one or more concurrent runs failed
#   2 - invalid arguments or missing required environment variables

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: run-concurrent-workflow-fixture-live.sh [--concurrency COUNT]

Options:
  --concurrency COUNT  Number of concurrent provisioning processes (default: 2)
  --help               Show this help

Required environment variables:
  AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT
  AZURE_FIXTURE_COORDINATION_CONTAINER
EOF
}

concurrency=2

while [ "$#" -gt 0 ]; do
  case "$1" in
    --concurrency)
      if [ "$#" -lt 2 ]; then
        echo "Error: --concurrency requires a value" >&2
        usage >&2
        exit 2
      fi
      concurrency="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$concurrency" in
  ''|*[!0-9]*)
    echo "Error: --concurrency must be a positive integer" >&2
    exit 2
    ;;
esac

if [ "$concurrency" -lt 1 ]; then
  echo "Error: --concurrency must be a positive integer" >&2
  exit 2
fi

if [ -z "${AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT:-}" ]; then
  echo "Error: AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT is required" >&2
  exit 2
fi

if [ -z "${AZURE_FIXTURE_COORDINATION_CONTAINER:-}" ]; then
  echo "Error: AZURE_FIXTURE_COORDINATION_CONTAINER is required" >&2
  exit 2
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
tests_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
log_dir="${TMPDIR:-/tmp}/workflow-fixture-live-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$log_dir"

export RUN_LIVE_AZURE_FIXTURE_TESTS=true

pids=()
run=1
while [ "$run" -le "$concurrency" ]; do
  (
    cd "$tests_dir"
    if npx tsx ./azure-fixtures/live/provision-workflow-fixture-live.ts \
      > "$log_dir/run-$run.log" 2>&1; then
      status=0
    else
      status=$?
    fi
    printf '%s\n' "$status" > "$log_dir/run-$run.exit"
  ) &
  pids[$run]=$!
  run=$((run + 1))
done

run=1
while [ "$run" -le "$concurrency" ]; do
  wait "${pids[$run]}"
  run=$((run + 1))
done

failed=0
run=1
while [ "$run" -le "$concurrency" ]; do
  status=$(cat "$log_dir/run-$run.exit")
  printf '===== run %s: exit %s =====\n' "$run" "$status"
  cat "$log_dir/run-$run.log"
  if [ "$status" -ne 0 ]; then
    failed=$((failed + 1))
  fi
  run=$((run + 1))
done

printf 'Logs: %s\n' "$log_dir"

if [ "$failed" -ne 0 ]; then
  printf 'Error: %s of %s concurrent runs failed\n' "$failed" "$concurrency" >&2
  exit 1
fi

printf 'All %s concurrent runs succeeded\n' "$concurrency"
