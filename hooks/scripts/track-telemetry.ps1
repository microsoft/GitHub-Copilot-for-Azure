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

$ErrorActionPreference = "SilentlyContinue"

# Return the success response required by every supported hook host.
function Write-Success {
    Write-Output '{"continue":true}'
    exit 0
}

# Dump raw input to AZURE_SKILLS_TELEMETRY_LOG_DIR/raw-input/ for debugging.
function Write-RawInputToFile {
    param([string]$RawInput)
    if (-not $env:AZURE_SKILLS_TELEMETRY_LOG_DIR) { return }
    $rawInputDir = Join-Path $env:AZURE_SKILLS_TELEMETRY_LOG_DIR 'raw-input'
    if (-not (Test-Path -LiteralPath $rawInputDir)) {
        New-Item -ItemType Directory -Path $rawInputDir -Force | Out-Null
    }
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
    $rawInputFile = Join-Path $rawInputDir "$timestamp.json"
    try {
        $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($rawInputFile, $RawInput, $utf8WithoutBom)
    } catch { }
}

# Append the published MCP arguments to the optional telemetry debug log.
function Write-TelemetryDebugLog {
    param([string]$Content)
    if (-not $env:AZURE_SKILLS_TELEMETRY_LOG_DIR) { return }
    $logFile = Join-Path $env:AZURE_SKILLS_TELEMETRY_LOG_DIR 'telemetry.log'
    $logEntry = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') | $Content"
    try {
        Add-Content -Path $logFile -Value $logEntry -ErrorAction SilentlyContinue
    } catch { }
}

# Resolve bundled skills relative to the installed hook. hooks/ and skills/ are
# siblings under each plugin root.
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$skillsDir = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'skills'

# Normalize paths for case-insensitive install-layout comparisons.
function Normalize-PathLower {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
    return (($Path.ToLowerInvariant() -replace '\\', '/') -replace '/+', '/')
}

# Return true only when the target belongs to this installed plugin copy. The
# hook is copied into every plugin, so this prevents duplicate reporting.
function Test-OwnedSkillPath {
    param([string]$TargetPath)
    if ([string]::IsNullOrWhiteSpace($TargetPath)) { return $false }
    $skillsRootNorm = (Normalize-PathLower $skillsDir).TrimEnd('/')
    $targetPathNorm = Normalize-PathLower $TargetPath
    return $targetPathNorm.StartsWith("$skillsRootNorm/", [System.StringComparison]::Ordinal)
}

# Match local plugin development paths configured through --plugin-dir.
function Test-LocalSkillPath {
    param([string]$NormalizedPath)
    if (-not $NormalizedPath -or -not $env:AZURE_SKILLS_PLUGIN_ROOT) { return $false }
    $localRoot = (Normalize-PathLower $env:AZURE_SKILLS_PLUGIN_ROOT).TrimEnd('/')
    return $NormalizedPath.Contains("$localRoot/skills/")
}

# Match every supported plugin installation layout, independent of the client
# that emitted the hook payload.
function Test-AzureSkillsPath {
    param([string]$Path)
    if (-not $Path) { return $false }

    # azure-skills plugin
    if ($Path -match '\.copilot/installed-plugins/[^/]+/azure/skills/') { return $true }
    if ($Path -match '\.claude/plugins/cache/(azure-skills|claude-plugins-official)/azure/[^/]+/skills/') {
        return $true
    }
    if ($Path -match '\.cursor/plugins/cache/[^/]+/azure/[^/]+/skills/') { return $true }
    if ($Path -match 'agent-plugins/github\.com/microsoft/azure-skills/\.github/plugins/azure-skills/skills/') {
        return $true
    }

    # azure-kusto-graph-skills plugin
    if ($Path -match '\.copilot/installed-plugins/[^/]+/azure-kusto-graph-skills/skills/') {
        return $true
    }
    if ($Path -match '\.claude/plugins/cache/azure-skills/azure-kusto-graph-skills/[^/]+/skills/') {
        return $true
    }
    if ($Path -match '\.cursor/plugins/cache/[^/]+/azure-kusto-graph-skills/[^/]+/skills/') {
        return $true
    }
    if ($Path -match 'agent-plugins/github\.com/microsoft/azure-skills/\.github/plugins/azure-kusto-graph-skills/skills/') {
        return $true
    }

    # Shared and local-development skill paths
    if ($Path -match '\.agents/skills/') { return $true }
    return Test-LocalSkillPath $Path
}

# Extract metadata.version from SKILL.md frontmatter. Return null when the file
# or version cannot be read.
function Get-SkillVersion {
    param([string]$SkillMdPath)
    if (-not $SkillMdPath) { return $null }
    $SkillMdPath = $SkillMdPath -replace '\\', '/'
    if (-not (Test-Path -LiteralPath $SkillMdPath)) { return $null }
    try {
        $lines = Get-Content -LiteralPath $SkillMdPath -ErrorAction Stop
    } catch { return $null }
    $inFrontmatter = $false
    foreach ($line in $lines) {
        if ($line -match '^---\s*$') {
            if (-not $inFrontmatter) { $inFrontmatter = $true; continue }
            break
        }
        if ($inFrontmatter -and $line -match '^\s*version:\s*(.+?)\s*$') {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

# Extract the built plugin version from the top-level .plugin/plugin.json.
function Get-PluginVersion {
    $pluginManifestPath = Join-Path (Split-Path -Parent $skillsDir) '.plugin/plugin.json'
    if (-not (Test-Path -LiteralPath $pluginManifestPath)) { return $null }
    try {
        $manifest = Get-Content -LiteralPath $pluginManifestPath -Raw -ErrorAction Stop |
            ConvertFrom-Json -ErrorAction Stop
        if ($manifest.version -is [string] -and -not [string]::IsNullOrWhiteSpace($manifest.version)) {
            return $manifest.version
        }
    } catch { }
    return $null
}

# Return path, filePath, or file_path from the client's tool input object.
function Get-ToolInputPath {
    param($ToolInput)
    if ($ToolInput.path) { return $ToolInput.path }
    if ($ToolInput.filePath) { return $ToolInput.filePath }
    if ($ToolInput.file_path) { return $ToolInput.file_path }
    return $null
}

# Initialize the normalized event contract returned by every client handler.
function New-TelemetryEvent {
    param([string]$ClientName, [string]$SessionId)
    return @{
        ShouldTrack = $false
        ClientName = $ClientName
        SessionId = $SessionId
        EventType = $null
        SkillName = $null
        SkillVersion = $null
        AzureToolName = $null
        FilePath = $null
    }
}

# Track a direct skill-tool call after the handler normalizes the skill name.
function Set-SkillByName {
    param([hashtable]$Event, [string]$Candidate)
    if (-not $Candidate) { return }
    $skillMdPath = Join-Path $skillsDir (Join-Path $Candidate 'SKILL.md')
    if ((Test-Path -LiteralPath $skillMdPath) -and (Test-OwnedSkillPath $skillMdPath)) {
        $Event.SkillName = $Candidate
        $Event.SkillVersion = Get-SkillVersion $skillMdPath
        $Event.EventType = "skill_invocation"
        $Event.ShouldTrack = $true
    }
}

# Track a SKILL.md read after the handler validates the client install path.
function Set-SkillRead {
    param([hashtable]$Event, [string]$TargetPath)
    if (-not (Test-OwnedSkillPath $TargetPath)) { return }
    $normalizedPath = ($TargetPath -replace '\\', '/') -replace '/+', '/'
    if ($normalizedPath -notmatch '/skills/([^/]+)/SKILL\.md$') { return }
    $Event.SkillName = $Matches[1]
    $Event.SkillVersion = Get-SkillVersion $TargetPath
    $Event.EventType = "skill_invocation"
    $Event.ShouldTrack = $true
}

# Capture a path relative to skills/. If no higher-priority event was already
# selected, classify the path as a reference_file_read and resolve its version.
function Set-ReferencePath {
    param([hashtable]$Event, [string]$TargetPath)
    if (-not (Test-OwnedSkillPath $TargetPath)) { return }
    $normalizedPath = ($TargetPath -replace '\\', '/') -replace '/+', '/'
    if ($normalizedPath -notmatch '.*/skills/(.+)$') { return }
    $Event.FilePath = $Matches[1]
    if (-not $Event.ShouldTrack) {
        $Event.EventType = "reference_file_read"
        $Event.ShouldTrack = $true
        $skillNameSegment = ($Event.FilePath -split '/')[0]
        $skillRootAbs = $normalizedPath.Substring(0, $normalizedPath.Length - $Event.FilePath.Length)
        $Event.SkillVersion = Get-SkillVersion "$skillRootAbs$skillNameSegment/SKILL.md"
    }
}

# Populate the normalized event fields for an Azure MCP tool invocation.
function Set-ToolInvocation {
    param([hashtable]$Event, [string]$ToolName)
    $Event.AzureToolName = $ToolName
    $Event.EventType = "tool_invocation"
    $Event.ShouldTrack = $true
}

# Detect the client once, before handing the payload to client-specific logic.
# Copilot's environment signal has highest precedence, followed by Cursor,
# VS Code, Claude Code, and the legacy Copilot toolArgs fallback.
function Get-ClientKey {
    param($InputData)
    if ($env:COPILOT_CLI -eq "1") { return "copilot-cli" }

    $hasHookEventName = $InputData.PSObject.Properties.Name -contains "hook_event_name"
    if ($hasHookEventName) {
        if ($InputData.cursor_version) { return "cursor" }
        $isVscodeToolUseId = $InputData.tool_use_id -and ($InputData.tool_use_id -match '__vscode')
        $isVscodeTranscript = $InputData.transcript_path -and
            ($InputData.transcript_path -match '[/\\]Code( - Insiders)?[/\\]')
        if ($isVscodeToolUseId -or $isVscodeTranscript) { return "vscode" }
        return "claude-code"
    }

    if ($InputData.PSObject.Properties.Name -contains "toolArgs") { return "copilot-cli" }
    return "unknown"
}

# === Publish Event ===

# Convert the normalized event to plugin-telemetry arguments and publish it.
# Telemetry publication is best-effort and must never block the host client.
function Publish-TelemetryEvent {
    param([hashtable]$Event)
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $pluginVersion = Get-PluginVersion
    $mcpArgs = @(
        "server", "plugin-telemetry",
        "--timestamp", $timestamp,
        "--client-name", $Event.ClientName
    )

    if ($Event.EventType) { $mcpArgs += "--event-type"; $mcpArgs += $Event.EventType }
    if ($Event.SessionId) { $mcpArgs += "--session-id"; $mcpArgs += $Event.SessionId }
    if ($Event.SkillName) { $mcpArgs += "--skill-name"; $mcpArgs += $Event.SkillName }
    if ($Event.SkillVersion) { $mcpArgs += "--skill-version"; $mcpArgs += $Event.SkillVersion }
    if ($pluginVersion) { $mcpArgs += "--plugin-version"; $mcpArgs += $pluginVersion }
    if ($Event.AzureToolName) { $mcpArgs += "--tool-name"; $mcpArgs += $Event.AzureToolName }
    if ($Event.FilePath) {
        $mcpArgs += "--file-reference"
        $mcpArgs += ($Event.FilePath -replace '/', '\')
    }

    try {
        & npx -y @azure/mcp@latest @mcpArgs 2>&1 | Out-Null
    } catch { }
    Write-TelemetryDebugLog -Content "MCP Args: $($mcpArgs -join ' ')"
}

# === Main Processing ===

# Skip collection when the user has opted out.
if ($env:AZURE_MCP_COLLECT_TELEMETRY -eq "false") {
    Write-Success
}

# Hooks send one complete JSON object per invocation. Windows PowerShell can
# decode redirected UTF-8 input through its OEM code page, so reconstruct the
# original UTF-8 text before parsing.
try {
    $stdinEncoding = [Console]::InputEncoding
    $rawInput = [Console]::In.ReadToEnd()
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    $rawInput = $utf8WithoutBom.GetString($stdinEncoding.GetBytes($rawInput))
} catch {
    Write-Success
}

# Some clients prefix the JSON stream with a UTF-8 BOM.
if ($rawInput.Length -gt 0 -and [int]$rawInput[0] -eq 0xFEFF) {
    $rawInput = $rawInput.Substring(1)
}
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    Write-Success
}

# Log the exact normalized JSON used for parsing when debugging is enabled.
Write-RawInputToFile -RawInput $rawInput

# Parse once in the entry point so handlers receive their native payload shape.
try {
    $inputData = $rawInput | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Success
}

# Load only the detected client's parser and event-classification rules.
$clientKey = Get-ClientKey $inputData
$handlerPath = Join-Path $scriptDir "clients/$clientKey.ps1"
if ($clientKey -eq "unknown" -or -not (Test-Path -LiteralPath $handlerPath)) {
    Write-Success
}

try {
    . $handlerPath
    $telemetryEvent = Get-TelemetryEvent -InputData $inputData
} catch {
    Write-Success
}

# Publish a classified event, then always return the host success response.
if ($telemetryEvent.ShouldTrack) {
    Publish-TelemetryEvent $telemetryEvent
}
Write-Success
