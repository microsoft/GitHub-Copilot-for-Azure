# Tests the shared telemetry installer with a locally produced runtime ZIP.
#
# Exit codes:
#   0 = installation, cache reuse, and executable smoke test passed
#   1 = installation or validation failed
#   2 = usage or argument error

param(
    [string] $ZipPath,
    [string] $Version = '0.1.0',
    [switch] $KeepCache
)

# Writes a test failure to the error stream without changing the intended exit code.
function Write-TestError {
    param([string] $Message)
    Write-Error -Message $Message -ErrorAction Continue
}

# Runs the installer in a child PowerShell process and returns its installed executable path.
function Invoke-TelemetryInstaller {
    param(
        [string] $PowerShellExecutable,
        [string] $InstallerPath,
        [string] $ReporterVersion
    )

    $arguments = @(
        '-NoProfile',
        '-NonInteractive'
    )
    if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') {
        $arguments += '-ExecutionPolicy'
        $arguments += 'Bypass'
    }
    $arguments += '-File'
    $arguments += $InstallerPath
    $arguments += '-Version'
    $arguments += $ReporterVersion

    $output = @(& $PowerShellExecutable @arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Installer exited with code $exitCode. $($output -join [Environment]::NewLine)"
    }
    if ($output.Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]$output[-1])) {
        throw 'Installer did not return the installed executable path.'
    }

    return [string]$output[-1]
}

if ([string]::IsNullOrWhiteSpace($ZipPath)) {
    Write-TestError 'The -ZipPath parameter is required.'
    exit 2
}
if ($Version -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]*$') {
    Write-TestError "Invalid telemetry reporter version: $Version"
    exit 2
}

try {
    $resolvedZipPath = (Resolve-Path -LiteralPath $ZipPath -ErrorAction Stop).Path
}
catch {
    Write-TestError "Telemetry ZIP not found: $ZipPath"
    exit 2
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..') -ErrorAction Stop).Path
$installerPath = Join-Path $repoRoot 'hooks\scripts\install-telemetry.ps1'
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    Write-TestError "Telemetry installer not found: $installerPath"
    exit 1
}

$testRoot = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    "ghcfa-telem-install-test-$([guid]::NewGuid().ToString('N'))"
$cacheRoot = Join-Path $testRoot 'cache'
$missingZipPath = Join-Path $testRoot 'missing-after-install.zip'
$powerShellExecutable = (Get-Process -Id $PID).Path

$previousLocalAppData = $env:LOCALAPPDATA
$previousXdgCacheHome = $env:XDG_CACHE_HOME
$previousZipPath = $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH
$previousTelemetrySetting = $env:AZURE_MCP_COLLECT_TELEMETRY

try {
    New-Item -ItemType Directory -Path $cacheRoot -Force -ErrorAction Stop | Out-Null
    $env:LOCALAPPDATA = $cacheRoot
    $env:XDG_CACHE_HOME = $cacheRoot
    $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH = $resolvedZipPath

    Write-Host "Installing telemetry reporter $Version from '$resolvedZipPath'..."
    $installedPath = Invoke-TelemetryInstaller `
        -PowerShellExecutable $powerShellExecutable `
        -InstallerPath $installerPath `
        -ReporterVersion $Version

    if (-not (Test-Path -LiteralPath $installedPath -PathType Leaf)) {
        throw "Installer returned a path that does not exist: $installedPath"
    }

    $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH = $missingZipPath
    $cachedPath = Invoke-TelemetryInstaller `
        -PowerShellExecutable $powerShellExecutable `
        -InstallerPath $installerPath `
        -ReporterVersion $Version
    if ($cachedPath -ne $installedPath) {
        throw "Cached installer path '$cachedPath' did not match '$installedPath'."
    }

    $env:AZURE_MCP_COLLECT_TELEMETRY = 'false'
    $helpOutput = @(& $installedPath --help 2>&1)
    $helpExitCode = $LASTEXITCODE
    if ($helpExitCode -ne 0) {
        throw "Installed executable --help exited with code $helpExitCode. $($helpOutput -join [Environment]::NewLine)"
    }
    if (($helpOutput -join [Environment]::NewLine) -notmatch 'Usage:') {
        throw 'Installed executable --help output did not contain the expected usage text.'
    }

    Write-Host "Local telemetry installation test passed: $installedPath"
    if ($KeepCache) {
        Write-Host "Test cache retained at: $testRoot"
    }
    exit 0
}
catch {
    Write-TestError $_.Exception.Message
    exit 1
}
finally {
    $env:LOCALAPPDATA = $previousLocalAppData
    $env:XDG_CACHE_HOME = $previousXdgCacheHome
    $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH = $previousZipPath
    $env:AZURE_MCP_COLLECT_TELEMETRY = $previousTelemetrySetting

    if (-not $KeepCache -and (Test-Path -LiteralPath $testRoot -PathType Container)) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
