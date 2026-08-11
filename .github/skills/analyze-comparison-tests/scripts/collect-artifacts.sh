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

if [[ -z "$DATE" || -z "$SKILL_NAME" ]]; then
  echo "Error: input JSON must define 'date' and 'skill.name'." >&2
  exit 2
fi

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
    SKILL_SUFFIX="with-skill"
  else
    SKILL_SUFFIX="without-skill"
  fi

  # Discover stimuli for this run by listing blobs under {date}/{runId}/{skill-name}_ prefix.
  echo "Discovering stimuli for run $RUN_ID under $CONTAINER/$DATE/$RUN_ID/$SKILL_NAME/${SKILL_NAME}_ ..."
  if ! DISCOVERY_RESULT=$(az storage blob list \
    --account-name "$STORAGE_ACCOUNT" \
    --container-name "$CONTAINER" \
    --prefix "$DATE/$RUN_ID/$SKILL_NAME/${SKILL_NAME}_" \
    --auth-mode login \
    --query "[?ends_with(name, '.md')].name" \
    -o tsv); then
    echo "Error: failed to discover blobs for run $RUN_ID." >&2
    FAILED=1
    continue
  fi

  # Extract unique stimuli names from blob paths.
  # Blob path: {date}/{runId}/{skill}/{skill}_{stimuli}/agent-metadata-*.md
  DISCOVERED_STIMULI=$(echo "$DISCOVERY_RESULT" | grep -o "/${SKILL_NAME}_[^/]*/" | sed "s|/||g; s|${SKILL_NAME}_||" | sort -u)

  if [[ -z "$DISCOVERED_STIMULI" ]]; then
    echo "Warning: no stimuli directories discovered for run $RUN_ID" >&2
    continue
  fi

  echo "Discovered stimuli for run $RUN_ID: $DISCOVERED_STIMULI"

  while IFS= read -r STIMULI_PART; do
    [[ -z "$STIMULI_PART" ]] && continue
    # Organize output by discovered stimuli name.
    STIMULI_OUTPUT_DIR="$OUTPUT_ROOT/$STIMULI_PART/$MODEL-$SKILL_SUFFIX"

    PREFIX="$DATE/$RUN_ID/$SKILL_NAME/${SKILL_NAME}_$STIMULI_PART/agent-metadata-"

    echo "Listing blobs for stimuli '$STIMULI_PART' in run $RUN_ID ..."
    if ! BLOBS=$(az storage blob list \
      --account-name "$STORAGE_ACCOUNT" \
      --container-name "$CONTAINER" \
      --prefix "$PREFIX" \
      --auth-mode login \
      --query "[?ends_with(name, '.md')].name" \
      -o tsv); then
      echo "Error: failed to list blobs for run $RUN_ID, stimuli $STIMULI_PART." >&2
      FAILED=1
      continue
    fi

    if [[ -z "$BLOBS" ]]; then
      echo "Warning: no trajectory blobs found for run $RUN_ID, stimuli $STIMULI_PART." >&2
      continue
    fi

    mkdir -p "$STIMULI_OUTPUT_DIR"

    while IFS= read -r BLOB; do
      [[ -z "$BLOB" ]] && continue
      FILE_NAME="${BLOB##*/}"
      echo "  downloading $FILE_NAME -> $STIMULI_OUTPUT_DIR"
      if ! az storage blob download \
        --account-name "$STORAGE_ACCOUNT" \
        --container-name "$CONTAINER" \
        --name "$BLOB" \
        --file "$STIMULI_OUTPUT_DIR/$FILE_NAME" \
        --auth-mode login \
        --overwrite \
        --no-progress \
        -o none; then
        echo "Error: failed to download blob $BLOB" >&2
        FAILED=1
      fi
    done <<< "$BLOBS"
  done <<< "$DISCOVERED_STIMULI"
done <<< "$RUNS"

if [[ "$FAILED" -ne 0 ]]; then
  echo "Completed with errors. Partial artifacts are in $OUTPUT_ROOT" >&2
  exit 1
fi

echo "Artifacts collected in $OUTPUT_ROOT"
exit 0
