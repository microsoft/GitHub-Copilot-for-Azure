#!/bin/bash

# Telemetry tracking hook for Azure Copilot Skills
# Reads JSON input from stdin, tracks relevant events, and publishes via MCP

set +e  # Don't exit on errors - fail silently for privacy

# Return success and exit
return_success() {
    echo '{"continue":true}'
    exit 0
}

# === JSON Parsing Functions (using sed - portable across platforms) ===

# Extract simple string field from JSON
extract_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | sed -n "s/.*\"$field\":\s*\"\([^\"]*\)\".*/\1/p"
}

# Extract nested field from toolArgs (e.g., toolArgs.skill)
extract_toolargs_field() {
    local json="$1"
    local field="$2"
    echo "$json" | sed -n "s/.*\"toolArgs\":\s*{[^}]*\"$field\":\s*\"\([^\"]*\)\".*/\1/p"
}

# Extract path from toolArgs (handles both 'path' and 'filePath')
extract_toolargs_path() {
    local json="$1"
    local path_value=""

    # Try 'path' field first, then 'filePath' - using sed for portability
    path_value=$(echo "$json" | sed -n 's/.*"toolArgs":\s*{[^}]*"path":\s*"\([^"]*\)".*/\1/p')
    if [ -z "$path_value" ]; then
        path_value=$(echo "$json" | sed -n 's/.*"toolArgs":\s*{[^}]*"filePath":\s*"\([^"]*\)".*/\1/p')
    fi

    echo "$path_value"
}

# === Main Processing ===

# Check if stdin has data
if [ -t 0 ]; then
    return_success
fi

# Read entire stdin at once - hooks send one complete JSON per invocation
rawInput=$(cat)

# Return success and exit if no input
if [ -z "$rawInput" ]; then
    return_success
fi

# === STEP 1: Read and parse input ===

# Extract fields from hook data (Copilot CLI format only)
toolName=$(extract_json_field "$rawInput" "toolName")
sessionId=$(extract_json_field "$rawInput" "sessionId")
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# TODO: Update client_type detection when adding VS Code support
clientType="copilot-cli"

# Skip if not Copilot CLI format
if [ -z "$toolName" ]; then
    return_success
fi

# === STEP 2: Determine what to track for azmcp ===

shouldTrack=false
eventType=""
skillName=""
azureToolName=""
filePath=""

# Check for skill invocation via 'skill' tool
if [ "$toolName" = "skill" ]; then
    skillName=$(extract_toolargs_field "$rawInput" "skill")
    if [ -n "$skillName" ]; then
        eventType="plugin_invocation"
        shouldTrack=true
    fi
fi

# Check for skill invocation (reading SKILL.md files)
if [ "$toolName" = "view" ]; then
    pathToCheck=$(extract_toolargs_path "$rawInput")
    if [ -n "$pathToCheck" ]; then
        # Normalize path: convert to lowercase, replace backslashes, and squeeze consecutive slashes
        pathLower=$(echo "$pathToCheck" | tr '[:upper:]' '[:lower:]' | tr '\\' '/' | sed 's|//*|/|g')

        # Check for SKILL.md pattern
        if [[ "$pathLower" == *".copilot"*"skills"*"/skill.md" ]]; then
            # Normalize path and extract skill name using regex
            pathNormalized=$(echo "$pathToCheck" | tr '\\' '/' | sed 's|//*|/|g')
            if [[ "$pathNormalized" =~ /skills/([^/]+)/SKILL\.md$ ]]; then
                skillName="${BASH_REMATCH[1]}"
                eventType="plugin_invocation"
                shouldTrack=true
                filePath="$pathToCheck"
            fi
        fi
    fi
fi

# Check for Azure MCP tool invocation (handles both "mcp_azure_" and "azure-" prefixes)
if [ -n "$toolName" ]; then
    if [[ "$toolName" == mcp_azure_* ]] || [[ "$toolName" == azure-* ]]; then
        azureToolName="$toolName"
        eventType="tool_invocation"
        shouldTrack=true
    fi
fi

# Capture file path from any tool input (only track files in azure\skills folder)
# Check both 'path' and 'filePath' properties
if [ -z "$filePath" ]; then
    pathToCheck=$(extract_toolargs_path "$rawInput")
    if [ -n "$pathToCheck" ]; then
        # Normalize path for matching: replace backslashes and squeeze consecutive slashes
        pathLower=$(echo "$pathToCheck" | tr '[:upper:]' '[:lower:]' | tr '\\' '/' | sed 's|//*|/|g')

        # Check if path matches the full installed-plugins azure skills folder structure
        if [[ "$pathLower" == *".copilot"*"installed-plugins"*"azure-skills"*"azure"*"skills"* ]]; then
            # Extract relative path after 'azure/skills/'
            pathNormalized=$(echo "$pathToCheck" | tr '\\' '/' | sed 's|//*|/|g')

            if [[ "$pathNormalized" =~ azure/skills/(.+)$ ]]; then
                filePath="${BASH_REMATCH[1]}"

                if [ "$shouldTrack" = false ]; then
                    shouldTrack=true
                    eventType="reference_file_read"
                fi
            fi
        fi
    fi
fi

# === STEP 3: Publish event via azmcp ===

if [ "$shouldTrack" = true ]; then
    # Build MCP command arguments (using array for proper quoting)
    mcpArgs=(
        "server" "plugin-telemetry"
        "--timestamp" "$timestamp"
        "--client-type" "$clientType"
    )

    [ -n "$eventType" ] && mcpArgs+=("--event-type" "$eventType")
    [ -n "$sessionId" ] && mcpArgs+=("--session-id" "$sessionId")
    [ -n "$skillName" ] && mcpArgs+=("--plugin-name" "$skillName")
    [ -n "$azureToolName" ] && mcpArgs+=("--tool-name" "$azureToolName")
    # Convert forward slashes to backslashes for azmcp allowlist compatibility
    [ -n "$filePath" ] && mcpArgs+=("--file-reference" "$(echo "$filePath" | tr '/' '\\')")

    # Publish telemetry via npx
    npx -y @azure/mcp@latest "${mcpArgs[@]}" 2>/dev/null || true
fi

# Output success to stdout (required by hooks)
return_success
