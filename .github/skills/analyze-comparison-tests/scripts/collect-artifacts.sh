#!/usr/bin/env bash
# collect-artifacts.sh — download comparison test trajectories from Azure Storage.
#
# Usage: collect-artifacts.sh <input.json>
#
# Exit codes:
#   0 = success (all runs collected)
#   1 = a step failed (missing dependency, Azure error, or no blobs found)
#   2 = usage/argument error

set -euo pipefail

STORAGE_ACCOUNT="strdashboarddevveobvk"
CONTAINER="manual-integration-reports"
OUTPUT_ROOT="comparison-artifacts"

usage() {
  cat <<'EOF'
Usage: collect-artifacts.sh <input.json>

Exit codes:
  0 = success (all runs collected)
  1 = a step failed (missing dependency, Azure error, or no blobs found)
  2 = usage/argument error
EOF
}

# Mirrors sanitizeTestName() used by the test harness when writing blob paths.
sanitize_test_name() {
  printf '%s' "$1" \
    | tr '<>:"/\\|?*' '---------' \
    | sed -E 's/[[:space:]]+/_/g; s/-+/-/g; s/_+/_/g' \
    | cut -c1-200
}

if [[ $# -eq 1 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  echo "Error: expected exactly one argument (path to the input JSON file)." >&2
  usage >&2
  exit 2
fi

INPUT_FILE="$1"

if [[ ! -f "$INPUT_FILE" ]]; then
  echo "Error: input file not found: $INPUT_FILE" >&2
  exit 2
fi

for cmd in jq az; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' is not installed." >&2
    exit 1
  fi
done

DATE=$(jq -r '.date // empty' "$INPUT_FILE")
SKILL_NAME=$(jq -r '.skill.name // empty' "$INPUT_FILE")
STIMULI_NAME=$(jq -r '.stimuliName // empty' "$INPUT_FILE")

if [[ -z "$DATE" || -z "$SKILL_NAME" || -z "$STIMULI_NAME" ]]; then
  echo "Error: input JSON must define 'date', 'skill.name', and 'stimuliName'." >&2
  exit 2
fi

SANITIZED_STIMULI_NAME=$(sanitize_test_name "$STIMULI_NAME")

RUNS=$(jq -r '.runs[] | [.model, (.withSkill | tostring), .run] | @tsv' "$INPUT_FILE")

if [[ -z "$RUNS" ]]; then
  echo "Error: input JSON contains no runs." >&2
  exit 2
fi

mkdir -p "$OUTPUT_ROOT"

FAILED=0

while IFS=$'\t' read -r MODEL WITH_SKILL RUN_URL; do
  [[ -z "$MODEL" ]] && continue

  RUN_ID="${RUN_URL##*/}"
  if [[ -z "$RUN_ID" ]]; then
    echo "Error: could not extract run id from URL: $RUN_URL" >&2
    FAILED=1
    continue
  fi

  if [[ "$WITH_SKILL" == "true" ]]; then
    DEST_DIR="$OUTPUT_ROOT/$MODEL-with-skill"
  else
    DEST_DIR="$OUTPUT_ROOT/$MODEL-without-skill"
  fi

  PREFIX="$DATE/$RUN_ID/$SKILL_NAME/${SKILL_NAME}_$SANITIZED_STIMULI_NAME/agent-metadata-"

  echo "Listing blobs under $CONTAINER/$PREFIX ..."
  if ! BLOBS=$(az storage blob list \
    --account-name "$STORAGE_ACCOUNT" \
    --container-name "$CONTAINER" \
    --prefix "$PREFIX" \
    --auth-mode login \
    --query "[?ends_with(name, '.md')].name" \
    -o tsv); then
    echo "Error: failed to list blobs for run $RUN_ID." >&2
    FAILED=1
    continue
  fi

  if [[ -z "$BLOBS" ]]; then
    echo "Error: no trajectory blobs found under $PREFIX" >&2
    FAILED=1
    continue
  fi

  mkdir -p "$DEST_DIR"

  while IFS= read -r BLOB; do
    [[ -z "$BLOB" ]] && continue
    FILE_NAME="${BLOB##*/}"
    echo "  downloading $FILE_NAME -> $DEST_DIR"
    if ! az storage blob download \
      --account-name "$STORAGE_ACCOUNT" \
      --container-name "$CONTAINER" \
      --name "$BLOB" \
      --file "$DEST_DIR/$FILE_NAME" \
      --auth-mode login \
      --overwrite \
      --no-progress \
      -o none; then
      echo "Error: failed to download blob $BLOB" >&2
      FAILED=1
    fi
  done <<< "$BLOBS"
done <<< "$RUNS"

if [[ "$FAILED" -ne 0 ]]; then
  echo "Completed with errors. Partial artifacts are in $OUTPUT_ROOT" >&2
  exit 1
fi

echo "Artifacts collected in $OUTPUT_ROOT"
exit 0
