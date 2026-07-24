$azd = Get-Command azd -ErrorAction SilentlyContinue
if (-not $azd) {
    Write-Output "Detected: azd is not installed. Recommend installing Azure Developer CLI for the full Microsoft Foundry skill experience; ask the user first, because installation is optional."
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
    Write-Output "Detected: azd is installed, but its extensions could not be inspected. If you later work on a Foundry agent, always remember to run the verify-environment script in the create sub-skill to verify and install the local-development environment."
    exit 0
}

try {
    $extensions = $extensionList | ConvertFrom-Json -ErrorAction Stop
    $foundryInstalled = @($extensions) | Where-Object { $_.id -eq "microsoft.foundry" } | Select-Object -First 1
} catch {
    Write-Output "Detected: azd is installed, but its extensions could not be inspected. If you later work on a Foundry agent, always remember to run the verify-environment script in the create sub-skill to verify and install the local-development environment."
    exit 0
}

if ($foundryInstalled) {
    Write-Output "Detected: azd and microsoft.foundry are installed. Foundry agent development capability is ready."
} else {
    Write-Output "Detected: microsoft.foundry is not installed. Foundry agent development capability is not ready. If you later work on a Foundry agent, always remember to run the verify-environment script in the create sub-skill to verify and install the local-development environment."
}

exit 0
