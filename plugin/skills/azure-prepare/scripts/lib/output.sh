# =============================================================================
# output.sh — NEXT ACTION and COMPLETE output emitters.
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================

# ---------------------------------------------------------------------------
# Output emitters
# ---------------------------------------------------------------------------

# Writes null placeholders for the missing keys, saves state, and prints the NEXT ACTION block telling the LM what to do and which keys to fill.
write_next_action() {
    local id="$1"
    local i phaseLabel gate guidance allRefs

    # Ensure null placeholders exist for every missing need so the LM has a template.
    for i in "${!MISSING_PATHS[@]}"; do
        test_provided "${MISSING_PATHS[$i]}" || set_null "${MISSING_PATHS[$i]}"
    done
    save_state

    if [[ "$(step_phase "$id")" == 1 ]]; then phaseLabel='Phase 1 — Planning'; else phaseLabel='Phase 2 — Execution'; fi

    echo '=== AZURE-PREPARE :: NEXT ACTION ==='
    echo ''
    echo "Step:  $id  ($phaseLabel)"
    echo "Title: $(step_title "$id")"
    echo "State: $StateFile"
    echo ''
    gate="$(step_gate "$id")"
    if [[ "$gate" == true ]]; then
        echo '*** USER APPROVAL GATE — do not continue until the user approves. ***'
        echo ''
    fi
    echo 'What to do:'
    guidance="$(step_guidance "$id")"
    while IFS= read -r line; do printf '  %s\n' "${line%"${line##*[![:space:]]}"}"; done <<<"$guidance"
    echo ''
    allRefs="$( { step_refs "$id"; step_dynrefs "$id"; } | awk 'NF && !seen[$0]++')"
    if [[ -n "$allRefs" ]]; then
        echo 'Read for detail:'
        while IFS= read -r r; do echo "  - $r"; done <<<"$allRefs"
        echo ''
    fi
    echo 'Fill these keys in the state file (currently null):'
    for i in "${!MISSING_PATHS[@]}"; do
        echo "  - ${MISSING_PATHS[$i]} : ${MISSING_PROMPTS[$i]}"
    done
    echo ''
    echo 'Then re-run:'
    echo "  bash <skill>/scripts/prepare.sh \"$RepoPath\""
    echo ''
    echo '=== END NEXT ACTION ==='
}

# Saves state and prints the COMPLETE block directing the LM to hand off to azure-validate.
write_complete() {
    save_state
    local plan="$RepoPath/.azure/deployment-plan.md"
    echo '=== AZURE-PREPARE :: COMPLETE ==='
    echo ''
    echo 'All preparation steps are done.'
    echo "Plan: $plan  (Status: Ready for Validation)"
    echo ''
    echo 'Next: invoke the azure-validate skill.'
    echo 'Do NOT run azd up / azd deploy / terraform apply directly.'
    echo ''
    echo '=== END COMPLETE ==='
}
