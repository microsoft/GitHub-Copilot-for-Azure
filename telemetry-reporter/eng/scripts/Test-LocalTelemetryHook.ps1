# Tests the PowerShell telemetry hook end to end with a locally produced runtime ZIP.
#
# Exit codes:
#   0 = hook installation, reporter invocation, and cache reuse passed
#   1 = hook execution or validation failed
#   2 = usage or argument error

param(
    [string] $ZipPath,
    [switch] $AllowTelemetry,
    [switch] $KeepArtifacts
)

# Writes a test failure to the error stream without changing the intended exit code.
function Write-TestError {
    param([string] $Message)
    Write-Error -Message $Message -ErrorAction Continue
}

# Runs the telemetry hook in a child PowerShell process with the payload on standard input.
function Invoke-TelemetryHook {
    param(
        [string] $PowerShellExecutable,
        [string] $HookPath,
        [string] $Payload
    )

    $arguments = '-NoProfile -NonInteractive'
    if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') {
        $arguments += ' -ExecutionPolicy Bypass'
    }
    $arguments += " -File `"$HookPath`""

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $PowerShellExecutable
    $startInfo.Arguments = $arguments
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    $startInfo.StandardInputEncoding = $utf8WithoutBom
    $startInfo.StandardOutputEncoding = $utf8WithoutBom
    $startInfo.StandardErrorEncoding = $utf8WithoutBom

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) {
            throw 'Unable to start the telemetry hook process.'
        }
        $process.StandardInput.Write($Payload)
        $process.StandardInput.Close()
        $standardOutput = $process.StandardOutput.ReadToEnd()
        $standardError = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StandardOutput = $standardOutput
            StandardError = $standardError
        }
    }
    finally {
        $process.Dispose()
    }
}

# Verifies that one hook execution completed successfully and returned the hook protocol response.
function Assert-HookResult {
    param(
        [pscustomobject] $Result,
        [string] $InvocationName
    )

    if ($Result.ExitCode -ne 0) {
        throw "$InvocationName hook execution exited with code $($Result.ExitCode). $($Result.StandardError)"
    }
    if ($Result.StandardOutput.Trim() -ne '{"continue":true}') {
        throw "$InvocationName hook output was unexpected: $($Result.StandardOutput)"
    }
}

if ([string]::IsNullOrWhiteSpace($ZipPath)) {
    Write-TestError 'The -ZipPath parameter is required.'
    exit 2
}
if (-not $AllowTelemetry) {
    Write-TestError 'The end-to-end hook test sends one telemetry event. Pass -AllowTelemetry to continue.'
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
$sourceHooksPath = Join-Path $repoRoot 'hooks'
if (-not (Test-Path -LiteralPath $sourceHooksPath -PathType Container)) {
    Write-TestError "Shared hooks directory not found: $sourceHooksPath"
    exit 1
}

$testRoot = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    "ghcfa-telem-hook-test-$([guid]::NewGuid().ToString('N'))"
$pluginRoot = Join-Path $testRoot 'plugin'
$cacheRoot = Join-Path $testRoot 'cache'
$telemetryLogDirectory = Join-Path $testRoot 'logs'
$powerShellExecutable = (Get-Process -Id $PID).Path

$previousLocalAppData = $env:LOCALAPPDATA
$previousXdgCacheHome = $env:XDG_CACHE_HOME
$previousZipPath = $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH
$previousStandaloneSetting = $env:AZURE_SKILLS_USE_STANDALONE_TELEMETRY
$previousTelemetrySetting = $env:AZURE_MCP_COLLECT_TELEMETRY
$previousTelemetryLogDirectory = $env:AZURE_SKILLS_TELEMETRY_LOG_DIR
$previousCopilotCliSetting = $env:COPILOT_CLI
$previousPluginRoot = $env:AZURE_SKILLS_PLUGIN_ROOT

try {
    New-Item -ItemType Directory -Path $pluginRoot -Force -ErrorAction Stop | Out-Null
    New-Item -ItemType Directory -Path $cacheRoot -Force -ErrorAction Stop | Out-Null
    New-Item -ItemType Directory -Path $telemetryLogDirectory -Force -ErrorAction Stop | Out-Null
    Copy-Item -LiteralPath $sourceHooksPath -Destination $pluginRoot -Recurse -ErrorAction Stop

    $pluginManifestDirectory = Join-Path $pluginRoot '.plugin'
    New-Item -ItemType Directory -Path $pluginManifestDirectory -Force -ErrorAction Stop | Out-Null
    @{
        name = 'azure'
        version = '0.0.0-local-test'
    } |
        ConvertTo-Json |
        Set-Content `
            -LiteralPath (Join-Path $pluginManifestDirectory 'plugin.json') `
            -Encoding utf8 `
            -ErrorAction Stop

    $hookPath = Join-Path $pluginRoot 'hooks\scripts\track-telemetry.ps1'
    if (-not (Test-Path -LiteralPath $hookPath -PathType Leaf)) {
        throw "Copied telemetry hook not found: $hookPath"
    }

    $sessionId = [guid]::NewGuid().ToString()
    $payload = @{
        hook_event_name = 'SessionStart'
        session_id = $sessionId
        source = 'startup'
    } | ConvertTo-Json -Compress

    $env:LOCALAPPDATA = $cacheRoot
    $env:XDG_CACHE_HOME = $cacheRoot
    $env:AZURE_SKILLS_TELEMETRY_ZIP_PATH = $resolvedZipPath
    $env:AZURE_SKILLS_USE_STANDALONE_TELEMETRY = 'true'
    $env:AZURE_MCP_COLLECT_TELEMETRY = 'true'
    $env:AZURE_SKILLS_TELEMETRY_LOG_DIR = $telemetryLogDirectory
    $env:COPILOT_CLI = '1'
    $env:AZURE_SKILLS_PLUGIN_ROOT = $pluginRoot

    $firstResult = Invoke-TelemetryHook `
        -PowerShellExecutable $powerShellExecutable `
        -HookPath $hookPath `
        -Payload $payload
    Assert-HookResult -Result $firstResult -InvocationName 'Initial'

    $installedExecutables = @(
        Get-ChildItem `
            -LiteralPath $cacheRoot `
            -File `
            -Recurse `
            -Filter 'ghcfa-telem*' `
            -ErrorAction Stop
    )
    if ($installedExecutables.Count -ne 1) {
        throw "Expected one installed telemetry executable; found $($installedExecutables.Count)."
    }

    $telemetryLogPath = Join-Path $telemetryLogDirectory 'telemetry.log'
    if (-not (Test-Path -LiteralPath $telemetryLogPath -PathType Leaf)) {
        throw "Telemetry debug log was not created: $telemetryLogPath"
    }
    $telemetryLog = Get-Content -LiteralPath $telemetryLogPath -Raw -ErrorAction Stop
    $expectedArguments = "MCP Args: server plugin-telemetry --plugin-name azure --plugin-version 0.0.0-local-test --client-name copilot-cli"
    $argumentEntries = @(
        [regex]::Matches(
            $telemetryLog,
            [regex]::Escape($expectedArguments),
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    )
    if ($argumentEntries.Count -ne 1) {
        throw "Expected one telemetry argument log entry; found $($argumentEntries.Count)."
    }
    if ($telemetryLog -match 'Standalone telemetry reporter (installation failed|failed|exited with status)') {
        throw "Telemetry debug log contains a standalone reporter failure: $telemetryLog"
    }

    Write-Host "Local telemetry hook test passed: $($installedExecutables[0].FullName)"
    if ($KeepArtifacts) {
        Write-Host "Test artifacts retained at: $testRoot"
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
    $env:AZURE_SKILLS_USE_STANDALONE_TELEMETRY = $previousStandaloneSetting
    $env:AZURE_MCP_COLLECT_TELEMETRY = $previousTelemetrySetting
    $env:AZURE_SKILLS_TELEMETRY_LOG_DIR = $previousTelemetryLogDirectory
    $env:COPILOT_CLI = $previousCopilotCliSetting
    $env:AZURE_SKILLS_PLUGIN_ROOT = $previousPluginRoot

    if (-not $KeepArtifacts -and (Test-Path -LiteralPath $testRoot -PathType Container)) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
