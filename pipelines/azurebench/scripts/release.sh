#!/usr/bin/env bash
# Check, then validate or publish a benchmark release in the MSBench Registry.
#
# Usage: release.sh validate|publish
# Run from the repository root, signed in to Azure as the publisher.
# Environment: BENCHMARK, VERSION, METADATA, DATASET, PRIVATE (True/False),
#   BACKEND, SOURCE_REPOSITORY, SOURCE_COMMIT.
# Exit codes: 0 success, 1 a check or msbench-cli failed, 2 usage error.
set -euo pipefail

mode="${1:-}"
if [ "$mode" != "validate" ] && [ "$mode" != "publish" ]; then
  echo "Usage: release.sh validate|publish" >&2
  exit 2
fi
for name in BENCHMARK VERSION METADATA DATASET PRIVATE BACKEND SOURCE_REPOSITORY SOURCE_COMMIT; do
  if [ -z "${!name:-}" ]; then
    echo "Missing environment variable $name." >&2
    exit 2
  fi
done

here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/check-release.py" "$BENCHMARK" "$METADATA" "$DATASET"

args=(
  --metadata "$METADATA"
  --dataset "$DATASET"
  --source-repository "$SOURCE_REPOSITORY"
  --source-commit "$SOURCE_COMMIT"
  --backend "$BACKEND"
)
if [ "$PRIVATE" = "True" ]; then
  args+=(--private)
fi
# The CLI rejects --management-mode together with --validate-only.
if [ "$mode" = "validate" ]; then
  args+=(--validate-only)
else
  args+=(--management-mode self)
fi

msbench-cli registry add benchmark "$BENCHMARK@$VERSION" "${args[@]}"
