# Dot-sourced by track-telemetry.ps1 after Claude Code detection.

function Get-TelemetryEvent {
    param($InputData)
    $event = New-TelemetryEvent -ClientName "claude-code" -SessionId $InputData.session_id
    $toolName = $InputData.tool_name
    if (-not $toolName) { return $event }

    $toolInput = $InputData.tool_input
    if ($toolName -eq "Skill") {
        $candidate = $toolInput.skill
        if ($candidate -and $candidate.StartsWith("azure:")) {
            $candidate = $candidate.Substring(6)
        }
        Set-SkillByName -Event $event -Candidate $candidate
    }

    $pathToCheck = Get-ToolInputPath $toolInput
    $pathLower = Normalize-PathLower $pathToCheck
    if ((Test-FileReadTool $toolName) -and $pathToCheck -and
        (Test-AzureSkillsPath $pathLower) -and $pathLower.EndsWith("/skill.md")) {
        Set-SkillRead -Event $event -TargetPath $pathToCheck
    }

    if ($toolName.StartsWith("mcp__plugin_azure_azure__")) {
        Set-ToolInvocation -Event $event -ToolName $toolName
    }

    if (-not $event.SkillName -and $pathToCheck -and (Test-AzureSkillsPath $pathLower)) {
        Set-ReferencePath -Event $event -TargetPath $pathToCheck
    }
    return $event
}
