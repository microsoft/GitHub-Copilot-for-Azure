# Dot-sourced by track-telemetry.ps1 after Visual Studio Code detection.

function Get-TelemetryEvent {
    param($InputData)
    $clientName = "Visual Studio Code"
    if ($InputData.transcript_path -match '[/\\]Code - Insiders[/\\]') {
        $clientName = "Visual Studio Code - Insiders"
    }
    $event = New-TelemetryEvent -ClientName $clientName -SessionId $InputData.session_id
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
    if ($toolName -eq "read_file" -and $pathToCheck -and
        (Test-AzureSkillsPath $pathLower) -and $pathLower.EndsWith("/skill.md")) {
        Set-SkillRead -Event $event -TargetPath $pathToCheck
    }

    if ($toolName.StartsWith("mcp_azure_mcp_")) {
        Set-ToolInvocation -Event $event -ToolName $toolName
    }

    if (-not $event.SkillName -and $pathToCheck -and (Test-AzureSkillsPath $pathLower)) {
        Set-ReferencePath -Event $event -TargetPath $pathToCheck
    }
    return $event
}
