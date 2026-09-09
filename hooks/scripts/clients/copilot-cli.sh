# Sourced by track-telemetry.sh after Copilot CLI detection.

process_telemetry_event() {
    local raw_input="$1"
    local tool_name
    local path_to_check
    local path_lower
    local candidate

    clientName="copilot-cli"
    sessionId=$(extract_json_field "$raw_input" "sessionId")
    tool_name=$(extract_json_field "$raw_input" "toolName")
    [ -n "$tool_name" ] || return 0

    if [ "$tool_name" = "skill" ]; then
        candidate=$(extract_toolargs_field "$raw_input" "toolArgs" "skill")
        track_skill_by_name "$candidate"
    fi

    path_to_check=$(extract_toolargs_path "$raw_input" "toolArgs")
    path_lower=$(normalize_path_lower "$path_to_check")
    if [ "$tool_name" = "view" ] && [ -n "$path_to_check" ] \
        && is_azure_skills_path "$path_lower" && [[ "$path_lower" == *"/skill.md" ]]; then
        track_skill_read "$path_to_check"
    fi

    if [[ "$tool_name" == azure-* ]]; then
        track_tool_invocation "$tool_name"
    fi

    if [ -z "$skillName" ] && [ -n "$path_to_check" ] && is_azure_skills_path "$path_lower"; then
        capture_reference_path "$path_to_check"
    fi
}
