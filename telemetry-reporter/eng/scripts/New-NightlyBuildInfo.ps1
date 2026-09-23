#!/usr/bin/env pwsh
#Requires -Version 7

[CmdletBinding()]
param(
    [string] $CollectionUri = $env:SYSTEM_COLLECTIONURI,
    [string] $Project = $env:SYSTEM_TEAMPROJECT,
    [int] $DefinitionId = $env:SYSTEM_DEFINITIONID,
    [int] $BuildId = $env:BUILD_BUILDID,
    [string] $BuildReason = $env:BUILD_REASON,
    [string] $SourceVersion = $env:BUILD_SOURCEVERSION,
    [string] $RepositoryRoot,
    [string] $OutputPath,
    [string] $AccessToken = $env:SYSTEM_ACCESSTOKEN,
    [string] $WindowsPool = $env:WINDOWSPOOL,
    [string] $WindowsVmImage = $env:WINDOWSVMIMAGE,
    [string] $MacPool = $env:MACPOOL,
    [string] $MacVmImage = $env:MACVMIMAGE,
    [string] $LinuxPool = $env:LINUXPOOL,
    [string] $LinuxVmImage = $env:LINUXVMIMAGE,
    [string] $LinuxArmPool = $env:LINUXARMPOOL,
    [string] $LinuxArmVmImage = $env:LINUXARMVMIMAGE
)

Set-StrictMode -Version Latest

function Write-OutputVariable {
    param(
        [string] $Name,
        [string] $Value
    )

    if ([string]::IsNullOrWhiteSpace($Name)) {
        throw 'An Azure DevOps output variable name is required.'
    }

    Write-Host "##vso[task.setvariable variable=$Name;isOutput=true]$Value"
}

function Invoke-Git {
    param(
        [string[]] $Arguments,
        [switch] $AllowFailure
    )

    $output = & git -C $RepositoryRoot @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "git $($Arguments -join ' ') failed with exit code $exitCode.`n$($output -join [Environment]::NewLine)"
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = @($output)
    }
}

function Test-RelevantPath {
    param(
        [string] $Path
    )

    $normalizedPath = $Path.Replace('\', '/')
    return $normalizedPath -match '^telemetry-reporter/src/' -or
        $normalizedPath -match '^telemetry-reporter/resources/' -or
        $normalizedPath -match '^telemetry-reporter/eng/scripts/.+\.ps1$' -or
        $normalizedPath -match '^telemetry-reporter/Directory\.(Build|Packages)\.(props|targets)$' -or
        $normalizedPath -match '^telemetry-reporter/(global|version)\.json$' -or
        $normalizedPath -eq 'telemetry-reporter/ghcfa-telem.slnx' -or
        $normalizedPath -eq 'pipelines/telemetry-reporter-nightly.yml' -or
        $normalizedPath -eq 'telemetry-reporter/nuget.config' -or
        $normalizedPath -eq 'pipelines/templates/jobs/telemetry-reporter-build.yml' -or
        $normalizedPath -match '^pipelines/templates/variables/(image|globals)\.yml$'
}

function Get-PreviousScheduledBuild {
    if ([string]::IsNullOrWhiteSpace($CollectionUri) -or
        [string]::IsNullOrWhiteSpace($Project) -or
        $DefinitionId -le 0 -or
        [string]::IsNullOrWhiteSpace($AccessToken)) {
        throw 'Collection URI, project, definition ID, and System.AccessToken are required for scheduled change detection.'
    }

    $escapedProject = [Uri]::EscapeDataString($Project)
    $requestUri = "$($CollectionUri.TrimEnd('/'))/$escapedProject/_apis/build/builds" +
        "?definitions=$DefinitionId" +
        '&reasonFilter=schedule' +
        '&statusFilter=completed' +
        '&resultFilter=succeeded' +
        '&queryOrder=finishTimeDescending' +
        '&$top=20' +
        '&api-version=7.1'
    $headers = @{
        Authorization = "Bearer $AccessToken"
    }

    try {
        $response = Invoke-RestMethod -Uri $requestUri -Headers $headers -Method Get -ErrorAction Stop
    }
    catch {
        throw "Unable to query previous scheduled builds. $($_.Exception.Message)"
    }

    $previousBuilds = @($response.value |
        Where-Object {
            [int]$_.id -ne $BuildId -and
            -not [string]::IsNullOrWhiteSpace([string]$_.sourceVersion)
        } |
        Select-Object -First 1)
    if ($previousBuilds.Count -eq 0) {
        return $null
    }

    return $previousBuilds[0]
}

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = [System.IO.Path]::GetFullPath(
        (Join-Path -Path $PSScriptRoot -ChildPath '..' -AdditionalChildPath '..', '..')
    )
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $RepositoryRoot 'artifacts' 'build_info.json'
}
if (-not (Test-Path -LiteralPath $RepositoryRoot -PathType Container)) {
    Write-Error "Repository root '$RepositoryRoot' does not exist."
    exit 2
}
if ([string]::IsNullOrWhiteSpace($SourceVersion)) {
    $sourceResult = Invoke-Git -Arguments @('rev-parse', 'HEAD')
    $SourceVersion = ($sourceResult.Output | Select-Object -Last 1).Trim()
}
if ([string]::IsNullOrWhiteSpace($WindowsPool)) {
    $WindowsPool = 'azsdk-pool'
}
if ([string]::IsNullOrWhiteSpace($WindowsVmImage)) {
    $WindowsVmImage = 'windows-2022'
}
if ([string]::IsNullOrWhiteSpace($MacPool)) {
    $MacPool = 'Azure Pipelines'
}
if ([string]::IsNullOrWhiteSpace($MacVmImage)) {
    $MacVmImage = 'macos-latest'
}
if ([string]::IsNullOrWhiteSpace($LinuxPool)) {
    $LinuxPool = 'azsdk-pool'
}
if ([string]::IsNullOrWhiteSpace($LinuxVmImage)) {
    $LinuxVmImage = 'ubuntu-24.04'
}
if ([string]::IsNullOrWhiteSpace($LinuxArmPool)) {
    $LinuxArmPool = 'azsdk-pool-arm64'
}
if ([string]::IsNullOrWhiteSpace($LinuxArmVmImage)) {
    $LinuxArmVmImage = 'azure-linux-3-arm64'
}

$windowsMatrix = [ordered]@{
    win_x64 = [ordered]@{
        BuildRuntimeIdentifier = 'win-x64'
        Pool = $WindowsPool
        OSVmImage = $WindowsVmImage
    }
    win_arm64 = [ordered]@{
        BuildRuntimeIdentifier = 'win-arm64'
        Pool = $WindowsPool
        OSVmImage = $WindowsVmImage
    }
}
$macOSMatrix = [ordered]@{
    osx_x64 = [ordered]@{
        BuildRuntimeIdentifier = 'osx-x64'
        Pool = $MacPool
        OSVmImage = $MacVmImage
    }
    osx_arm64 = [ordered]@{
        BuildRuntimeIdentifier = 'osx-arm64'
        Pool = $MacPool
        OSVmImage = $MacVmImage
    }
}
$linuxX64Matrix = [ordered]@{
    linux_x64 = [ordered]@{
        BuildRuntimeIdentifier = 'linux-x64'
        Pool = $LinuxPool
        OSVmImage = $LinuxVmImage
    }
}
$linuxArm64Matrix = [ordered]@{
    linux_arm64 = [ordered]@{
        BuildRuntimeIdentifier = 'linux-arm64'
        Pool = $LinuxArmPool
        OSVmImage = $LinuxArmVmImage
    }
}

$shouldBuild = $true
$baselineCommit = $null
$changedFiles = @()

try {
    if ($BuildReason -eq 'Schedule') {
        $previousBuild = Get-PreviousScheduledBuild
        if ($null -ne $previousBuild) {
            $baselineCommit = [string]$previousBuild.sourceVersion
            $baselineCheck = Invoke-Git -Arguments @('cat-file', '-e', "$baselineCommit^{commit}") -AllowFailure
            if ($baselineCheck.ExitCode -ne 0) {
                $null = Invoke-Git -Arguments @('fetch', '--no-tags', 'origin', $baselineCommit)
            }

            $mergeBaseResult = Invoke-Git -Arguments @('merge-base', $baselineCommit, $SourceVersion)
            $mergeBase = ($mergeBaseResult.Output | Select-Object -Last 1).Trim()
            $diffResult = Invoke-Git -Arguments @('diff', '--name-only', "$mergeBase..$SourceVersion", '--')
            $changedFiles = @($diffResult.Output |
                ForEach-Object { $_.ToString().Trim() } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            $shouldBuild = @($changedFiles | Where-Object { Test-RelevantPath -Path $_ }).Count -gt 0
        }
    }

    $outputDirectory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Path $outputDirectory -Force -ErrorAction Stop | Out-Null
    [ordered]@{
        buildReason = $BuildReason
        sourceVersion = $SourceVersion
        baselineCommit = $baselineCommit
        shouldBuild = $shouldBuild
        changedFiles = $changedFiles
        matrices = [ordered]@{
            windows = $windowsMatrix
            macOS = $macOSMatrix
            linuxX64 = $linuxX64Matrix
            linuxArm64 = $linuxArm64Matrix
        }
    } |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath $OutputPath -Encoding utf8 -ErrorAction Stop

    Write-OutputVariable -Name 'ShouldBuild' -Value $shouldBuild.ToString().ToLowerInvariant()
    Write-OutputVariable -Name 'WindowsMatrix' -Value ($windowsMatrix | ConvertTo-Json -Depth 10 -Compress)
    Write-OutputVariable -Name 'MacOSMatrix' -Value ($macOSMatrix | ConvertTo-Json -Depth 10 -Compress)
    Write-OutputVariable -Name 'LinuxX64Matrix' -Value ($linuxX64Matrix | ConvertTo-Json -Depth 10 -Compress)
    Write-OutputVariable -Name 'LinuxArm64Matrix' -Value ($linuxArm64Matrix | ConvertTo-Json -Depth 10 -Compress)
    Write-OutputVariable -Name 'BaselineCommit' -Value ([string]$baselineCommit)

    if ($shouldBuild) {
        Write-Host 'Native AOT matrix will run.'
    }
    else {
        Write-Host 'No executable-affecting telemetry reporter changes were found; the Native AOT matrix will be skipped.'
    }
}
catch {
    Write-Error $_
    exit 1
}
