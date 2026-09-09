# Sourced by track-telemetry.sh after Claude Code detection.

process_telemetry_event() {
    local raw_input="$1"
    local tool_name
    local path_to_check
    local path_lower
    local candidate

    clientName="claude-code"
    sessionId=$(extract_json_field "$raw_input" "session_id")
    tool_name=$(extract_json_field "$raw_input" "tool_name")
    [ -n "$tool_name" ] || return 0

    if [ "$tool_name" = "Skill" ]; then
        candidate=$(extract_toolargs_field "$raw_input" "tool_input" "skill")
        candidate="${candidate#azure:}"
        track_skill_by_name "$candidate"
    fi

    path_to_check=$(extract_toolargs_path "$raw_input" "tool_input")
    path_lower=$(normalize_path_lower "$path_to_check")
    if [ "$tool_name" = "Read" ] && [ -n "$path_to_check" ] \
        && is_azure_skills_path "$path_lower" && [[ "$path_lower" == *"/skill.md" ]]; then
        track_skill_read "$path_to_check"
    fi

    if [[ "$tool_name" == mcp__plugin_azure_azure__* ]]; then
        track_tool_invocation "$tool_name"
    fi

    if [ -z "$skillName" ] && [ -n "$path_to_check" ] && is_azure_skills_path "$path_lower"; then
        capture_reference_path "$path_to_check"
    fi
}
