$azd = Get-Command azd -ErrorAction SilentlyContinue
if (-not $azd) {
    Write-Output "Detected: azd is not installed. Some Microsoft Foundry skill capabilities may be unavailable. Ask whether the user wants to install Azure Developer CLI; installation is optional. If they agree, open https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd to get installation instructions, then rerun this script after installation."
    exit 0
}

$env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"
try {
    $extensionList = (& azd extension list --installed --output json 2>$null) -join "`n"
    $listExitCode = $LASTEXITCODE
} catch {
    $extensionList = ""
    $listExitCode = 1
}

if ($listExitCode -ne 0) {
    Write-Output 'Detected: Foundry agent development capability could not be checked. If Foundry agent local development is needed, run the "Verify the environment" step in the create sub-skill to unlock the full local-development capability.'
    exit 0
}

try {
    $extensions = $extensionList | ConvertFrom-Json -ErrorAction Stop
    $foundryInstalled = @($extensions) | Where-Object { $_.id -eq "microsoft.foundry" } | Select-Object -First 1
} catch {
    Write-Output 'Detected: Foundry agent development capability could not be checked. If Foundry agent local development is needed, run the "Verify the environment" step in the create sub-skill to unlock the full local-development capability.'
    exit 0
}

if ($foundryInstalled) {
    Write-Output "Detected: azd and microsoft.foundry are installed. Foundry agent development capability is ready."
} else {
    Write-Output 'Detected: microsoft.foundry is not installed. Foundry agent development capability is not ready. If Foundry agent local development is needed, run the "Verify the environment" step in the create sub-skill to unlock the full local-development capability.'
}

exit 0
