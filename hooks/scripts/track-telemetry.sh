#!/usr/bin/env bash

# Telemetry tracking hook for Azure Copilot Skills.
# Reads JSON input from stdin, tracks relevant events, and publishes via MCP.
# Exit codes: 0 = hook handled or safely skipped.
#
# === Client Format Reference ===
#
# Copilot CLI:
#   - Field names:    camelCase (toolName, sessionId, toolArgs)
#   - Tool names:     lowercase (skill, view)
#   - MCP prefix:     azure-<command> (for example, azure-documentation)
#   - Skill prefix:   none (skill name as-is)
#   - Detection:      COPILOT_CLI is "1" (>=0.0.421); fallback is toolArgs
#                     without hook_event_name (<0.0.421)
#
# Claude Code:
#   - Field names:    snake_case (tool_name, session_id, tool_input,
#                     hook_event_name)
#   - Tool names:     PascalCase (Skill, Read, Edit)
#   - MCP prefix:     mcp__plugin_azure_azure__<command>
#   - Skill prefix:   azure:<skill-name> (for example, azure:azure-prepare)
#   - Detection:      has hook_event_name and tool_use_id does not contain
#                     "__vscode"
#
# Cursor:
#   - Field names:    snake_case (tool_name, session_id, tool_input,
#                     hook_event_name)
#   - Tool names:     PascalCase for file reads (Read); raw MCP tool name from
#                     afterMCPExecution
#   - Skill paths:    .cursor/plugins/cache/<catalog>/azure/<revision>/skills/
#   - Detection:      has hook_event_name and cursor_version
#   - MCP detection:  afterMCPExecution with mcp_server_name "azure"
#
# VS Code:
#   - Field names:    snake_case (tool_name, session_id, tool_input,
#                     hook_event_name)
#   - Tool names:     snake_case (read_file, replace_string_in_file)
#   - MCP prefix:     mcp_azure_mcp_<command>
#   - Skill paths:    .vscode/agent-plugins/github.com/microsoft/azure-skills/
#                     .github/plugins/azure-skills/skills/<name>/SKILL.md
#                     .vscode-insiders/agent-plugins/github.com/microsoft/
#                     azure-skills/.github/plugins/azure-skills/skills/
#                     <name>/SKILL.md
#                     .agents/skills/<name>/SKILL.md
#   - Detection:      has hook_event_name and tool_use_id contains "__vscode",
#                     or transcript_path contains "Code"
#   - Client name:    "Visual Studio Code" or
#                     "Visual Studio Code - Insiders", derived from
#                     transcript_path
#   - Note:           .agents/skills payloads can omit transcript_path, so
#                     stable and Insiders can only be distinguished when that
#                     path is available
#
# === Event Types ===
#
# 1. skill_invocation
#    - Triggered when the skill tool is called with a skill name, or when a
#      SKILL.md file is read from a recognized Azure skills path.
#    - Fields: --skill-name <name>, --skill-version <version>
#
# 2. tool_invocation
#    - Triggered by the client's Azure MCP prefix, or by Cursor's
#      afterMCPExecution event when mcp_server_name is "azure".
#    - Field: --tool-name <toolName>
#
# 3. reference_file_read
#    - Triggered when a client file-read tool targets a bundled file inside a
#      recognized Azure skills path that is not SKILL.md.
#    - Fields: --file-reference <relative-path-after-skills/>,
#      --skill-version <version>
#
# === Skill Version ===
#
# Skill versions come from metadata.version in the SKILL.md frontmatter, which
# is stamped at package build time:
#   - Direct skill call: <plugin-root>/skills/<name>/SKILL.md
#   - SKILL.md read: the file being read
#   - Reference read: the sibling SKILL.md at the root of the containing skill
#
# === Reference File Detection ===
#
# Client handlers extract a path from toolArgs or tool_input. The shared path
# matcher accepts every supported installation layout because one client can
# discover and invoke a plugin originally installed by another client:
#   azure-skills:
#   - .copilot/installed-plugins/<catalog>/azure/skills/...
#   - .claude/plugins/cache/azure-skills/azure/<version>/skills/...
#   - .claude/plugins/cache/claude-plugins-official/azure/<version>/skills/...
#   - .cursor/plugins/cache/<catalog>/azure/<revision>/skills/...
#   - .vscode/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/
#     azure-skills/skills/...
#   azure-kusto-graph-skills:
#   - .copilot/installed-plugins/<catalog>/azure-kusto-graph-skills/skills/...
#   - .claude/plugins/cache/azure-skills/azure-kusto-graph-skills/<version>/
#     skills/...
#   - .cursor/plugins/cache/<catalog>/azure-kusto-graph-skills/<revision>/
#     skills/...
#   - .vscode/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/
#     azure-kusto-graph-skills/skills/...
#   shared:
#   - .agents/skills/...
#
# If a path matches and is not SKILL.md, the path after skills/ is emitted as
# reference_file_read. SKILL.md reads are emitted as skill_invocation instead.
#
# === Debugging ===
#
# AZURE_SKILLS_TELEMETRY_LOG_DIR enables raw input logs under raw-input/ and
# appends published MCP arguments to telemetry.log.
#
# When using --plugin-dir, set AZURE_SKILLS_PLUGIN_ROOT so local skill paths
# can be recognized for reference_file_read events.
#
# Client-specific payload parsing and event classification live in clients/.
# This entry point owns client detection, shared skill/plugin helpers, telemetry
# publication, diagnostic logging, and the hook response contract.

set +e

# Return the success response required by every supported hook host.
return_success() {
    echo '{"continue":true}'
    exit 0
}

# Dump raw input to AZURE_SKILLS_TELEMETRY_LOG_DIR/raw-input/ for debugging.
write_raw_input_to_file() {
    local raw_input_value="$1"
    [ -n "$AZURE_SKILLS_TELEMETRY_LOG_DIR" ] || return 0
    local raw_input_dir="$AZURE_SKILLS_TELEMETRY_LOG_DIR/raw-input"
    mkdir -p "$raw_input_dir" 2>/dev/null || return 0
    local timestamp
    timestamp=$(date -u +"%Y%m%dT%H%M%SZ")
    printf '%s\n' "$raw_input_value" > "$raw_input_dir/$timestamp.json" 2>/dev/null || true
}

# Append the published MCP arguments to the optional telemetry debug log.
write_telemetry_debug_log() {
    local content="$1"
    [ -n "$AZURE_SKILLS_TELEMETRY_LOG_DIR" ] || return 0
    local log_file="$AZURE_SKILLS_TELEMETRY_LOG_DIR/telemetry.log"
    echo "$(date +"%Y-%m-%dT%H:%M:%S") | $content" >> "$log_file" 2>/dev/null || true
}

# Resolve bundled skills relative to the installed hook. hooks/ and skills/ are
# siblings under each plugin root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)/skills"

# Normalize paths for case-insensitive install-layout comparisons.
normalize_path_lower() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | tr '\\' '/' | sed 's|//*|/|g'
}

# Return true only when the target belongs to this installed plugin copy. The
# hook is copied into every plugin, so this prevents duplicate reporting.
is_owned_skill_path() {
    local target_path="$1"
    local skills_root_norm
    local target_path_norm
    skills_root_norm=$(normalize_path_lower "$SKILLS_DIR" | sed 's|/$||')
    target_path_norm=$(normalize_path_lower "$target_path")
    [[ "$target_path_norm" == "$skills_root_norm/"* ]]
}

# Match local plugin development paths configured through --plugin-dir.
is_local_skill_path() {
    local normalized_path="$1"
    [ -n "$AZURE_SKILLS_PLUGIN_ROOT" ] || return 1
    local local_root
    local_root=$(normalize_path_lower "$AZURE_SKILLS_PLUGIN_ROOT" | sed 's|/*$||')
    [[ "$normalized_path" == *"${local_root}/skills/"* ]]
}

# Match every supported plugin installation layout, independent of the client
# that emitted the hook payload.
is_azure_skills_path() {
    local path="$1"

    # azure-skills plugin
    [[ "$path" == *".copilot/installed-plugins/"*"/azure/skills/"* ]] && return 0
    [[ "$path" == *".claude/plugins/cache/azure-skills/azure/"*"/skills/"* ]] && return 0
    [[ "$path" == *".claude/plugins/cache/claude-plugins-official/azure/"*"/skills/"* ]] && return 0
    [[ "$path" == *".cursor/plugins/cache/"*"/azure/"*"/skills/"* ]] && return 0
    [[ "$path" == *"agent-plugins/github.com/microsoft/azure-skills/.github/plugins/azure-skills/skills/"* ]] && return 0

    # azure-kusto-graph-skills plugin
    [[ "$path" == *".copilot/installed-plugins/"*"/azure-kusto-graph-skills/skills/"* ]] && return 0
    [[ "$path" == *".claude/plugins/cache/azure-skills/azure-kusto-graph-skills/"*"/skills/"* ]] && return 0
    [[ "$path" == *".cursor/plugins/cache/"*"/azure-kusto-graph-skills/"*"/skills/"* ]] && return 0
    [[ "$path" == *"agent-plugins/github.com/microsoft/azure-skills/.github/plugins/azure-kusto-graph-skills/skills/"* ]] && return 0

    # Shared and local-development skill paths
    [[ "$path" == *".agents/skills/"* ]] && return 0
    is_local_skill_path "$path"
}

# Extract metadata.version from SKILL.md frontmatter. Print nothing when the
# file or version cannot be read.
get_skill_version() {
    local skill_md_path="$1"
    [ -n "$skill_md_path" ] || return 0
    skill_md_path="$(echo "$skill_md_path" | tr '\\' '/')"
    [ -f "$skill_md_path" ] || return 0
    sed -n '/^---[[:space:]]*$/,/^---[[:space:]]*$/p' "$skill_md_path" 2>/dev/null \
        | grep -E '^[[:space:]]*version:[[:space:]]*' \
        | head -1 \
        | sed -E 's/^[[:space:]]*version:[[:space:]]*//; s/^["'"'"']//; s/["'"'"'][[:space:]]*$//; s/[[:space:]]*$//'
}

# Extract the built plugin version from the top-level .plugin/plugin.json.
get_plugin_version() {
    local plugin_manifest_path
    plugin_manifest_path="$(dirname "$SKILLS_DIR")/.plugin/plugin.json"
    [ -f "$plugin_manifest_path" ] || return 0
    node -e '
        try {
            const manifest = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
            if (typeof manifest.version === "string" && manifest.version) process.stdout.write(manifest.version);
        } catch { }
    ' "$plugin_manifest_path" 2>/dev/null
}

# === Shared JSON Parsing Helpers ===

# Extract a top-level string field from the hook JSON.
extract_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | sed -n "s/.*\"$field\":[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

# Extract a string field from a specific toolArgs/tool_input container.
extract_toolargs_field() {
    local json="$1"
    local container="$2"
    local field="$3"
    echo "$json" | sed -n "s/.*\"$container\":[[:space:]]*{[^}]*\"$field\":[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

# Extract a path, filePath, or file_path property from a tool input container.
extract_toolargs_path() {
    local json="$1"
    local container="$2"
    local path_value=""
    path_value=$(extract_toolargs_field "$json" "$container" "path")
    [ -n "$path_value" ] || path_value=$(extract_toolargs_field "$json" "$container" "filePath")
    [ -n "$path_value" ] || path_value=$(extract_toolargs_field "$json" "$container" "file_path")
    echo "$path_value"
}

# Initialize the normalized event contract populated by each client handler.
reset_telemetry_event() {
    shouldTrack=false
    clientName=""
    sessionId=""
    eventType=""
    skillName=""
    skillVersion=""
    azureToolName=""
    filePath=""
}

# Track a direct skill-tool call after the handler normalizes the skill name.
track_skill_by_name() {
    local candidate="$1"
    local skill_md_path
    [ -n "$candidate" ] || return 0
    skill_md_path="$SKILLS_DIR/$candidate/SKILL.md"
    if [ -f "$skill_md_path" ] && is_owned_skill_path "$skill_md_path"; then
        skillName="$candidate"
        skillVersion=$(get_skill_version "$skill_md_path")
        eventType="skill_invocation"
        shouldTrack=true
    fi
}

# Track a SKILL.md read after the handler validates the client install path.
track_skill_read() {
    local target_path="$1"
    local normalized_path
    local candidate
    is_owned_skill_path "$target_path" || return 0
    normalized_path=$(echo "$target_path" | tr '\\' '/' | sed 's|//*|/|g')
    candidate=$(echo "$normalized_path" | sed -n 's|.*/skills/\([^/]*\)/[Ss][Kk][Ii][Ll][Ll]\.[Mm][Dd]$|\1|p')
    [ -n "$candidate" ] || return 0
    skillName="$candidate"
    skillVersion=$(get_skill_version "$target_path")
    eventType="skill_invocation"
    shouldTrack=true
}

# Capture a path relative to skills/. If no higher-priority event was already
# selected, classify the path as a reference_file_read and resolve its version.
capture_reference_path() {
    local target_path="$1"
    local normalized_path
    local skill_name_segment
    local skill_root_abs
    is_owned_skill_path "$target_path" || return 0
    normalized_path=$(echo "$target_path" | tr '\\' '/' | sed 's|//*|/|g')
    filePath=$(echo "$normalized_path" | sed -n 's|.*/skills/||p')
    [ -n "$filePath" ] || return 0
    if [ "$shouldTrack" = false ]; then
        eventType="reference_file_read"
        shouldTrack=true
        skill_name_segment="${filePath%%/*}"
        skill_root_abs="${normalized_path:0:${#normalized_path}-${#filePath}}"
        skillVersion=$(get_skill_version "${skill_root_abs}${skill_name_segment}/SKILL.md")
    fi
}

# Populate the normalized event fields for an Azure MCP tool invocation.
track_tool_invocation() {
    azureToolName="$1"
    eventType="tool_invocation"
    shouldTrack=true
}

# Detect the client once, before handing the payload to client-specific logic.
# Copilot's environment signal has highest precedence, followed by Cursor,
# VS Code, Claude Code, and the legacy Copilot toolArgs fallback.
detect_client() {
    local raw_input="$1"
    local tool_use_id
    local transcript_path
    local transcript_path_norm
    local cursor_version

    if [ "$COPILOT_CLI" = "1" ]; then
        echo "copilot-cli"
        return 0
    fi

    if echo "$raw_input" | grep -Fq '"hook_event_name"'; then
        tool_use_id=$(extract_json_field "$raw_input" "tool_use_id")
        transcript_path=$(extract_json_field "$raw_input" "transcript_path")
        cursor_version=$(extract_json_field "$raw_input" "cursor_version")
        transcript_path_norm=$(echo "$transcript_path" | tr '\\' '/')
        if [ -n "$cursor_version" ]; then
            echo "cursor"
        elif [[ "$tool_use_id" == *"__vscode"* ]] \
            || [[ "$transcript_path_norm" == */Code/* ]] \
            || [[ "$transcript_path_norm" == */Code\ -\ Insiders/* ]]; then
            echo "vscode"
        else
            echo "claude-code"
        fi
        return 0
    fi

    if echo "$raw_input" | grep -Fq '"toolArgs"'; then
        echo "copilot-cli"
        return 0
    fi

    echo "unknown"
}

# === Publish Event ===

# Convert the normalized event to plugin-telemetry arguments and publish it.
# Telemetry publication is best-effort and must never block the host client.
publish_telemetry_event() {
    local timestamp
    local plugin_version
    local mcp_args
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    plugin_version=$(get_plugin_version)
    mcp_args=(
        "server" "plugin-telemetry"
        "--timestamp" "$timestamp"
        "--client-name" "$clientName"
    )

    [ -n "$eventType" ] && mcp_args+=("--event-type" "$eventType")
    [ -n "$sessionId" ] && mcp_args+=("--session-id" "$sessionId")
    [ -n "$skillName" ] && mcp_args+=("--skill-name" "$skillName")
    [ -n "$skillVersion" ] && mcp_args+=("--skill-version" "$skillVersion")
    [ -n "$plugin_version" ] && mcp_args+=("--plugin-version" "$plugin_version")
    [ -n "$azureToolName" ] && mcp_args+=("--tool-name" "$azureToolName")
    [ -n "$filePath" ] && mcp_args+=("--file-reference" "$(echo "$filePath" | tr '/' '\\')")

    npx -y @azure/mcp@latest "${mcp_args[@]}" >/dev/null 2>&1 || true
    write_telemetry_debug_log "MCP Args: ${mcp_args[*]}"
}

# === Main Processing ===

# Skip collection when opted out or when invoked without piped hook input.
if [ "${AZURE_MCP_COLLECT_TELEMETRY}" = "false" ] || [ -t 0 ]; then
    return_success
fi

# Hooks send one complete JSON object per invocation.
rawInput=$(cat)
[ -n "$rawInput" ] || return_success
write_raw_input_to_file "$rawInput"

# Load only the detected client's parser and event-classification rules.
client_key=$(detect_client "$rawInput")
handler_path="$SCRIPT_DIR/clients/$client_key.sh"
[ "$client_key" != "unknown" ] && [ -f "$handler_path" ] || return_success

reset_telemetry_event
. "$handler_path" 2>/dev/null || return_success
process_telemetry_event "$rawInput"

# Publish a classified event, then always return the host success response.
[ "$shouldTrack" = true ] && publish_telemetry_event
return_success
