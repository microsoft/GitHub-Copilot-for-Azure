<#
.SYNOPSIS
Runs concurrent live workflow-fixture provisioning processes.

.DESCRIPTION
Exit codes:
  0 - every concurrent run succeeded
  1 - one or more concurrent runs failed
  2 - invalid arguments or missing required environment variables
#>

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $CliArguments
)

function Write-Usage {
    @'
Usage: run-concurrent-workflow-fixture-live.ps1 [-Concurrency COUNT]

Options:
  -Concurrency COUNT  Number of concurrent provisioning processes (default: 2)
  -Help               Show this help

Required environment variables:
  AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT
  AZURE_FIXTURE_COORDINATION_CONTAINER
'@
}

function Write-ArgumentError {
    param([string] $Message)

    [Console]::Error.WriteLine("Error: $Message")
    [Console]::Error.WriteLine((Write-Usage))
    exit 2
}

$concurrency = 2
$argumentIndex = 0

while ($argumentIndex -lt $CliArguments.Count) {
    switch ($CliArguments[$argumentIndex]) {
        '-Concurrency' {
            if ($argumentIndex + 1 -ge $CliArguments.Count) {
                Write-ArgumentError '-Concurrency requires a value'
            }

            $value = 0
            if (-not [int]::TryParse($CliArguments[$argumentIndex + 1], [ref] $value) -or $value -lt 1) {
                Write-ArgumentError '-Concurrency must be a positive integer'
            }

            $concurrency = $value
            $argumentIndex += 2
        }
        '-Help' {
            Write-Usage
            exit 0
        }
        default {
            Write-ArgumentError "unknown option $($CliArguments[$argumentIndex])"
        }
    }
}

if ([string]::IsNullOrWhiteSpace($env:AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT)) {
    [Console]::Error.WriteLine('Error: AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT is required')
    exit 2
}

if ([string]::IsNullOrWhiteSpace($env:AZURE_FIXTURE_COORDINATION_CONTAINER)) {
    [Console]::Error.WriteLine('Error: AZURE_FIXTURE_COORDINATION_CONTAINER is required')
    exit 2
}

$testsDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$logDirectory = Join-Path ([IO.Path]::GetTempPath()) "workflow-fixture-live-$timestamp-$PID"
New-Item -ItemType Directory -Path $logDirectory | Out-Null

$env:RUN_LIVE_AZURE_FIXTURE_TESTS = 'true'
$jobs = @()

for ($run = 1; $run -le $concurrency; $run++) {
    $logPath = Join-Path $logDirectory "run-$run.log"
    $exitPath = Join-Path $logDirectory "run-$run.exit"

    $jobs += Start-Job -ArgumentList $testsDirectory, $logPath, $exitPath -ScriptBlock {
        param($TestsDirectory, $LogPath, $ExitPath)

        Set-Location $TestsDirectory
        & npx tsx '.\azure-fixtures\live\provision-workflow-fixture-live.ts' *> $LogPath
        $status = $LASTEXITCODE

        if ($null -eq $status) {
            $status = 1
        }

        [IO.File]::WriteAllText($ExitPath, "$status$([Environment]::NewLine)")
    }
}

$jobs | Wait-Job | Out-Null
$jobs | Receive-Job | Out-Null
$jobs | Remove-Job

$failed = 0

for ($run = 1; $run -le $concurrency; $run++) {
    $logPath = Join-Path $logDirectory "run-$run.log"
    $exitPath = Join-Path $logDirectory "run-$run.exit"

    if (-not (Test-Path -LiteralPath $exitPath -PathType Leaf)) {
        [Console]::Error.WriteLine("Error: run $run did not produce an exit status")
        $status = 1
    }
    else {
        $status = [int] (Get-Content -LiteralPath $exitPath -Raw)
    }

    Write-Output "===== run ${run}: exit $status ====="
    if (Test-Path -LiteralPath $logPath -PathType Leaf) {
        [Console]::Out.Write((Get-Content -LiteralPath $logPath -Raw))
    }

    if ($status -ne 0) {
        $failed++
    }
}

Write-Output "Logs: $logDirectory"

if ($failed -ne 0) {
    [Console]::Error.WriteLine("Error: $failed of $concurrency concurrent runs failed")
    exit 1
}

Write-Output "All $concurrency concurrent runs succeeded"
