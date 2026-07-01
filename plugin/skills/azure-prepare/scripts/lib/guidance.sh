# =============================================================================
# guidance.sh — Per-step LM instruction text (step_guidance).
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
#
# The guidance bodies live as plain-text files in lib/guidance/<step-id>.txt so
# they can be shared verbatim with the PowerShell driver (steps.ps1 loads the
# same files). Edit the .txt files, not this loader.
# =============================================================================

# Directory holding the shared per-step guidance text files.
GUIDANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/guidance" && pwd)"

# Prints the LM instruction text (guidance) for the given step id, or nothing
# when the step has no guidance file (e.g. automatic steps).
step_guidance() {
    local f="$GUIDANCE_DIR/$1.txt"
    [[ -f "$f" ]] && cat "$f"
}
