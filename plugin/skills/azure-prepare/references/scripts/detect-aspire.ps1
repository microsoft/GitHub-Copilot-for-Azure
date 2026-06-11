<#
.SYNOPSIS
    Presence check: determines whether a workspace is a .NET Aspire application.
    Use this at detection/routing points where you only need a yes/no answer.
    To gather the deeper deployment facts (ExcludeFromManifest, Azure Functions,
    secret storage, AppHost source dir), use gather-aspire-info.ps1 instead.

.DESCRIPTION
    Runs the minimal deterministic presence sequence:
      1. Find the AppHost project (*.AppHost.csproj)
      2. Confirm Aspire.Hosting or Aspire.AppHost.Sdk package references

    Output: key=value lines (isAspire, appHostPath) followed by a short
    human-readable summary.

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
}

function ConvertTo-Lower([bool]$value) {
    if ($value) { "true" } else { "false" }
}

# Machine-readable result
Write-Output "isAspire=$(ConvertTo-Lower $isAspire)"
Write-Output "appHostPath=$appHostPath"

# Human-readable summary
Write-Output ""
Write-Output "Summary:"
if (-not $isAspire) {
    Write-Output "- No .NET Aspire app detected in '$WorkspaceRoot' (no *.AppHost.csproj or Aspire.Hosting / Aspire.AppHost.Sdk package reference)."
    exit 0
}

if ($appHostPath) {
    Write-Output "- .NET Aspire app detected. AppHost project: $appHostPath"
} else {
    Write-Output "- Aspire.Hosting / Aspire.AppHost.Sdk package reference found, but no *.AppHost.csproj was located."
}
Write-Output "- Run gather-aspire-info.ps1 to gather other essential deployment information."
