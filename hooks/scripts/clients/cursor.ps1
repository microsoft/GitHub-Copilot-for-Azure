# Dot-sourced by track-telemetry.ps1 after Cursor detection.

function Get-TelemetryEvent {
    param($InputData)
    $event = New-TelemetryEvent -ClientName "cursor" -SessionId $InputData.session_id
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
    if ($toolName -eq "Read" -and $pathToCheck -and
        (Test-AzureSkillsPath $pathLower) -and $pathLower.EndsWith("/skill.md")) {
        Set-SkillRead -Event $event -TargetPath $pathToCheck
    }

    if ($InputData.hook_event_name -eq "afterMCPExecution" -and
        $InputData.mcp_server_name -eq "azure") {
        $azureToolName = $toolName
        if ($azureToolName.StartsWith("MCP:", [System.StringComparison]::Ordinal)) {
            $azureToolName = $azureToolName.Substring(4)
        }
        Set-ToolInvocation -Event $event -ToolName $azureToolName
    }

    if (-not $event.SkillName -and $pathToCheck -and (Test-AzureSkillsPath $pathLower)) {
        Set-ReferencePath -Event $event -TargetPath $pathToCheck
    }
    return $event
}
