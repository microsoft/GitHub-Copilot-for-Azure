#!/usr/bin/env bash
# =============================================================================
# State-machine driver for the azure-prepare skill (Bash port of prepare.ps1).
#
# Drives the "prepare an app for Azure deployment" workflow as a deterministic
# state machine. The script owns <RepoPath>/.azure-prepare/prepare-info.json and
# advances the workflow as far as it can PROGRAMMATICALLY on each invocation.
# When it needs information only the language model (LM) can provide, it writes
# null placeholder keys under `input.*`, prints a NEXT ACTION block describing
# exactly what to collect, and exits. The LM fills the keys and re-runs the
# script. The cycle repeats until the script prints a COMPLETE block.
#
# Usage:
#     bash ./prepare.sh <RepoPath>
# =============================================================================
set -o pipefail

# ---------------------------------------------------------------------------
# Argument parsing and paths
# ---------------------------------------------------------------------------
if [[ $# -lt 1 || -z "${1:-}" ]]; then
    echo "Usage: prepare.sh <RepoPath>" >&2
    exit 2
fi
RepoPath="$1"
if [[ ! -d "$RepoPath" ]]; then
    echo "RepoPath does not exist: $RepoPath" >&2
    exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
    echo "prepare.sh requires the 'jq' command-line JSON processor." >&2
    exit 1
fi
RepoPath="$(cd "$RepoPath" && pwd)"
StateDir="$RepoPath/.azure-prepare"
StateFile="$StateDir/prepare-info.json"
SchemaVersion=1

# STATE holds the entire JSON state document in memory between get/set helpers.
STATE='{}'

# ---------------------------------------------------------------------------
# Load library modules (sourced; they only define functions/data).
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/state.sh"
source "$SCRIPT_DIR/lib/collect.sh"
source "$SCRIPT_DIR/lib/plan.sh"
source "$SCRIPT_DIR/lib/refs.sh"
source "$SCRIPT_DIR/lib/steps.sh"
source "$SCRIPT_DIR/lib/guidance.sh"
source "$SCRIPT_DIR/lib/output.sh"

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
get_state
invoke_auto_collect

for step in "${STEP_IDS[@]}"; do
    # Ensure a status entry exists for this step (default pending).
    if [[ "$(printf '%s' "$STATE" | jq -r --arg id "$step" '.steps | has($id)')" != true ]]; then
        set_str "steps.$step" 'pending'
    fi
    [[ "$(get_by_path "steps.$step")" == 'done' ]] && continue

    # Run the step's auto collector (may satisfy needs programmatically).
    step_auto "$step"

    # Determine missing needs.
    MISSING_PATHS=()
    MISSING_PROMPTS=()
    while IFS=$'\t' read -r np prompt; do
        [[ -n "$np" ]] || continue
        if ! test_provided "$np"; then
            MISSING_PATHS+=("$np")
            MISSING_PROMPTS+=("$prompt")
        fi
    done < <(step_needs "$step")

    if [[ ${#MISSING_PATHS[@]} -gt 0 ]]; then
        write_next_action "$step"
        exit 0
    fi

    # All needs satisfied — finalize the step.
    step_ondone "$step"
    set_str "steps.$step" 'done'
    save_state
done

write_complete
