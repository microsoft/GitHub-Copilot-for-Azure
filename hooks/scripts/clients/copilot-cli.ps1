# Dot-sourced by track-telemetry.ps1 after Copilot CLI detection.

function Get-TelemetryEvent {
    param($InputData)
    $event = New-TelemetryEvent -ClientName "copilot-cli" -SessionId $InputData.sessionId
    $toolName = $InputData.toolName
    if (-not $toolName) { return $event }

    $toolInput = $InputData.toolArgs
    if ($toolName -eq "skill") {
        Set-SkillByName -Event $event -Candidate $toolInput.skill
    }

    $pathToCheck = Get-ToolInputPath $toolInput
    $pathLower = Normalize-PathLower $pathToCheck
    if ((Test-FileReadTool $toolName) -and $pathToCheck -and
        (Test-AzureSkillsPath $pathLower) -and $pathLower.EndsWith("/skill.md")) {
        Set-SkillRead -Event $event -TargetPath $pathToCheck
    }

    if ($toolName.StartsWith("azure-")) {
        Set-ToolInvocation -Event $event -ToolName $toolName
    }

    if (-not $event.SkillName -and $pathToCheck -and (Test-AzureSkillsPath $pathLower)) {
        Set-ReferencePath -Event $event -TargetPath $pathToCheck
    }
    return $event
}
