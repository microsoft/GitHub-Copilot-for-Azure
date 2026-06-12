<#
.SYNOPSIS
    Gathers the detailed facts the azure-prepare skill needs to plan deployment
    of a .NET Aspire application. Use this in Aspire-specific reference files,
    AFTER presence has been established (see detect-aspire.ps1).

.DESCRIPTION
    Runs the full deterministic detection sequence in one pass:
      1. Find the AppHost project (*.AppHost.csproj)
      2. Confirm Aspire.Hosting or Aspire.AppHost.Sdk package references
      3. Derive the AppHost source directory
      4. Scan the AppHost *.cs for ExcludeFromManifest (informational)
      5. Scan for AddAzureFunctionsProject, and if present, check whether
         AzureWebJobsSecretStorageType is already configured

    Output: key=value lines the agent can branch on, followed by a
    human-readable summary. The remediation decision (whether/how to add
    .WithEnvironment("AzureWebJobsSecretStorageType", "Files")) stays with the agent.

.PARAMETER WorkspaceRoot
    Workspace root directory to scan. Defaults to the current directory.

.EXAMPLE
    ./gather-aspire-info.ps1
    Scan the current directory.

.EXAMPLE
    ./gather-aspire-info.ps1 -WorkspaceRoot ./src/MyApp
    Scan a specific workspace root.
#>

param(
    [string]$WorkspaceRoot = "."
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $WorkspaceRoot -PathType Container)) {
    Write-Error "workspace root '$WorkspaceRoot' is not a directory"
    exit 1
}

# Defaults (emitted when the workspace is not an Aspire app)
$isAspire = $false
$appHostPath = ""
$appHostDir = ""
$hasExcludeFromManifest = $false
$hasFunctions = $false
$secretStorageConfigured = $false

# Step 1: Find the AppHost project (sorted for deterministic selection)
$appHostProject = @(Get-ChildItem -LiteralPath $WorkspaceRoot -Recurse -Filter "*.AppHost.csproj" -File -ErrorAction SilentlyContinue |
    Sort-Object FullName) | Select-Object -First 1

# Step 2: Confirm Aspire package references anywhere in the workspace
$hasAspirePackage = $false
$csprojFiles = Get-ChildItem -LiteralPath $WorkspaceRoot -Recurse -Filter "*.csproj" -File -ErrorAction SilentlyContinue
if ($csprojFiles) {
    if ($csprojFiles | Select-String -Pattern "Aspire\.Hosting|Aspire\.AppHost\.Sdk" -List -ErrorAction SilentlyContinue) {
        $hasAspirePackage = $true
    }
}

if ($appHostProject -or $hasAspirePackage) {
    $isAspire = $true
}

if ($appHostProject) {
    # Emit a workspace-relative, forward-slash path (matches the bash output contract)
    Push-Location -LiteralPath $WorkspaceRoot
    try {
        $appHostPath = (Resolve-Path -LiteralPath $appHostProject.FullName -Relative) -replace '\\', '/'
    } finally {
        Pop-Location
    }

    # Step 3: Derive the AppHost source directory
    $appHostDir = $appHostPath -replace '/[^/]+$', ''
    $appHostDirFull = $appHostProject.DirectoryName

    # Scan AppHost *.cs, excluding bin/ and obj/ build output
    $appHostCs = Get-ChildItem -LiteralPath $appHostDirFull -Recurse -Filter "*.cs" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/](bin|obj)[\\/]' }

    # Step 4: Scan the AppHost source for ExcludeFromManifest (informational)
    if ($appHostCs -and ($appHostCs | Select-String -Pattern "ExcludeFromManifest" -SimpleMatch -List -ErrorAction SilentlyContinue)) {
        $hasExcludeFromManifest = $true
    }

    # Step 5: Detect Azure Functions and secret-storage configuration
    if ($appHostCs -and ($appHostCs | Select-String -Pattern "AddAzureFunctionsProject" -SimpleMatch -List -ErrorAction SilentlyContinue)) {
        $hasFunctions = $true
        if ($appHostCs | Select-String -Pattern "AzureWebJobsSecretStorageType" -SimpleMatch -List -ErrorAction SilentlyContinue) {
            $secretStorageConfigured = $true
        }
    }
}

function ConvertTo-Lower([bool]$value) {
    if ($value) { "true" } else { "false" }
}

# Machine-readable result
Write-Output "isAspire=$(ConvertTo-Lower $isAspire)"
Write-Output "appHostPath=$appHostPath"
Write-Output "appHostDir=$appHostDir"
Write-Output "hasExcludeFromManifest=$(ConvertTo-Lower $hasExcludeFromManifest)"
Write-Output "hasFunctions=$(ConvertTo-Lower $hasFunctions)"
Write-Output "secretStorageConfigured=$(ConvertTo-Lower $secretStorageConfigured)"

# Human-readable summary
Write-Output ""
Write-Output "Summary:"
if (-not $isAspire) {
    Write-Output "- No .NET Aspire app detected in '$WorkspaceRoot' (no *.AppHost.csproj or Aspire.Hosting / Aspire.AppHost.Sdk package reference)."
    exit 0
}

if ($appHostPath) {
    Write-Output "- .NET Aspire app detected. AppHost project: $appHostPath"
    Write-Output "- AppHost source directory: $appHostDir"
} else {
    Write-Output "- Aspire.Hosting / Aspire.AppHost.Sdk package reference found, but no *.AppHost.csproj was located."
}

if ($hasExcludeFromManifest) {
    Write-Output "- ExcludeFromManifest found in AppHost source (informational): the app may contain local-only resources."
} else {
    Write-Output "- No ExcludeFromManifest usage found in AppHost source."
}

if ($hasFunctions) {
    if ($secretStorageConfigured) {
        Write-Output "- AddAzureFunctionsProject found; AzureWebJobsSecretStorageType is configured in the AppHost source."
    } else {
        Write-Output "- AddAzureFunctionsProject found; AzureWebJobsSecretStorageType is not configured in the AppHost source."
    }
} else {
    Write-Output "- AddAzureFunctionsProject not found in AppHost source."
}
