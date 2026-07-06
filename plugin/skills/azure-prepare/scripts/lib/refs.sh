# =============================================================================
# refs.sh — SDK / service reference path resolution helpers.
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================


# ---------------------------------------------------------------------------
# SDK / service reference helpers
# ---------------------------------------------------------------------------

# Maps the project's languages (auto-detected files + LM-provided component technologies)
# to Azure SDK quick-reference language codes (nodejs/js/ts -> ts, python -> py, etc.).
# $1 (Kind) filters to codes that actually have a reference file for that SDK family
# (App Configuration has no .NET quick-reference, so 'dotnet' is dropped for appconfig).
get_sdk_language_codes() {
    local kind="${1:-identity}" available codes=() l t tl
    if [[ "$kind" == 'appconfig' ]]; then available="py ts java"; else available="py dotnet ts java"; fi

    # Adds a code when it is available for this kind and not already collected.
    _add_code() {
        local c="$1"
        [[ " $available " == *" $c "* ]] || return 0
        in_list "$c" "${codes[@]:-}" && return 0
        codes+=("$c")
    }

    while IFS= read -r l; do
        [[ -n "$l" ]] || continue
        case "$l" in
            nodejs) _add_code ts ;;
            python) _add_code py ;;
            dotnet) _add_code dotnet ;;
            java)   _add_code java ;;
        esac
    done < <(printf '%s' "$STATE" | jq -r '(.auto.detectedLanguages // [])[]')

    local re_net='dotnet|c#|csharp|asp|\.net'
    while IFS= read -r t; do
        tl="${t,,}"
        [[ "$tl" =~ (node|javascript|typescript|(^|[^a-z])(ts|js)($|[^a-z])) ]] && _add_code ts
        [[ "$tl" =~ (python|(^|[^a-z])py($|[^a-z])|flask|django|fastapi) ]] && _add_code py
        [[ "$tl" =~ $re_net ]] && _add_code dotnet
        [[ "$tl" =~ (java|spring) ]] && _add_code java
    done < <(printf '%s' "$STATE" | jq -r '(.input.components // [])[] | .technology // ""')

    (( ${#codes[@]} )) && printf '%s\n' "${codes[@]}"
    return 0
}

# Returns 0 if any service named in the LM-provided architecture matches the given name regex.
test_architecture_uses_service() {
    local pattern="$1" svc
    while IFS= read -r svc; do
        [[ "$svc" =~ $pattern ]] && return 0
    done < <(printf '%s' "$STATE" | jq -r '(.input.architecture // [])[] | .azureService // ""')
    return 1
}

# Prints the Durable Functions + Durable Task Scheduler reference paths when the chosen
# architecture uses Durable Functions or the Durable Task Scheduler, else nothing. Lets the
# research/generate steps surface these refs on demand instead of the specialized-check step.
get_durable_refs() {
    local svc
    while IFS= read -r svc; do
        svc="${svc,,}"
        if [[ "$svc" == *durable* || "$svc" == *"task scheduler"* ]]; then
            printf 'scripts/references/services/functions/durable.md\n'
            printf 'scripts/references/services/durable-task-scheduler/README.md\n'
            printf 'scripts/references/services/durable-task-scheduler/bicep.md\n'
            return 0
        fi
    done < <(printf '%s' "$STATE" | jq -r '(.input.architecture // [])[] | .azureService // ""')
    return 0
}

# Maps each Azure service named in the LM-provided architecture to its reference README
# under scripts/references/services/, so the research step can name the exact files to
# read instead of a <service> placeholder. Prints a deduped list of README paths.
get_service_readme_refs() {
    local svc_pat=(
        'container app' 'app service' 'static web' 'aks|kubernetes' 'cosmos' 'sql'
        'key vault' 'service bus' 'event grid' 'logic app' 'storage|blob'
        'application insights|app insights' 'openai|foundry|cognitive' 'durable' 'function'
    )
    local svc_dir=(
        container-apps app-service static-web-apps aks cosmos-db sql-database
        key-vault service-bus event-grid logic-apps storage
        app-insights foundry durable-task-scheduler functions
    )
    local dirs=() svc i
    while IFS= read -r svc; do
        svc="${svc,,}"
        for i in "${!svc_pat[@]}"; do
            if [[ "$svc" =~ ${svc_pat[$i]} ]]; then
                in_list "${svc_dir[$i]}" "${dirs[@]:-}" || dirs+=("${svc_dir[$i]}")
            fi
        done
    done < <(printf '%s' "$STATE" | jq -r '(.input.architecture // [])[] | .azureService // ""')
    local d
    for d in "${dirs[@]:-}"; do
        [[ -n "$d" ]] && printf 'scripts/references/services/%s/README.md\n' "$d"
    done
}

