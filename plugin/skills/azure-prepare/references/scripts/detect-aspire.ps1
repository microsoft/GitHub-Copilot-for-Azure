<#
.SYNOPSIS
    Detects whether a workspace is a .NET Aspire application and gathers the
    facts the azure-prepare skill needs to plan deployment.

.DESCRIPTION
    Runs the full deterministic detection sequence in one pass:
      1. Find the AppHost project (*.AppHost.csproj)
      2. Confirm Aspire.Hosting package references
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
    ./detect-aspire.ps1
    Scan the current directory.

.EXAMPLE
    ./detect-aspire.ps1 -WorkspaceRoot ./src/MyApp
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

# Step 1: Find the AppHost project
$appHostProject = Get-ChildItem -Path $WorkspaceRoot -Recurse -Filter "*.AppHost.csproj" -File -ErrorAction SilentlyContinue |
    Select-Object -First 1

# Step 2: Confirm Aspire.Hosting package references anywhere in the workspace
$hasAspirePackage = $false
$csprojFiles = Get-ChildItem -Path $WorkspaceRoot -Recurse -Filter "*.csproj" -File -ErrorAction SilentlyContinue
if ($csprojFiles) {
    if ($csprojFiles | Select-String -Pattern "Aspire.Hosting" -SimpleMatch -List -ErrorAction SilentlyContinue) {
        $hasAspirePackage = $true
    }
}

if ($appHostProject -or $hasAspirePackage) {
    $isAspire = $true
}

if ($appHostProject) {
    $appHostPath = $appHostProject.FullName

    # Step 3: Derive the AppHost source directory
    $appHostDir = $appHostProject.DirectoryName

    $appHostCs = Get-ChildItem -Path $appHostDir -Recurse -Filter "*.cs" -File -ErrorAction SilentlyContinue

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
    Write-Output "- No .NET Aspire app detected in '$WorkspaceRoot' (no *.AppHost.csproj or Aspire.Hosting package reference)."
    exit 0
}

if ($appHostPath) {
    Write-Output "- .NET Aspire app detected. AppHost project: $appHostPath"
    Write-Output "- AppHost source directory: $appHostDir"
} else {
    Write-Output "- Aspire.Hosting package reference found, but no *.AppHost.csproj was located."
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
