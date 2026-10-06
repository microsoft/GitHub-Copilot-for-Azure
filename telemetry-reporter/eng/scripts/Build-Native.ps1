#!/usr/bin/env pwsh
#Requires -Version 7
# Builds and packages the telemetry reporter as a Native AOT executable for one supported runtime identifier, including host validation, optional smoke testing, runtime and symbol archives, and SHA-256 checksums.
# Exit codes: 0 = success, 1 = build, validation, or packaging failure.

[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string] $Configuration = 'Release',

    [ValidateSet('win-x64', 'win-arm64', 'linux-x64', 'linux-arm64', 'linux-musl-x64', 'linux-musl-arm64', 'osx-x64', 'osx-arm64')]
    [string] $RuntimeIdentifier,

    [string] $OutputRoot,

    [string] $RestoreConfigFile,

    [string] $MuslBuildImage,

    [switch] $NoClean
)

Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot 'NativePackaging.psm1') -Force -ErrorAction Stop
$supportedRuntimeIdentifiers = @(Get-NativeRuntimeIdentifierList)
$currentRuntimeIdentifier = [System.Runtime.InteropServices.RuntimeInformation]::RuntimeIdentifier
if ([string]::IsNullOrWhiteSpace($RuntimeIdentifier)) {
    $RuntimeIdentifier = $currentRuntimeIdentifier
}

if ($supportedRuntimeIdentifiers -notcontains $RuntimeIdentifier) {
    throw "Runtime identifier '$RuntimeIdentifier' is not supported."
}

$topology = Get-NativeBuildTopology -HostRuntimeIdentifier $currentRuntimeIdentifier -TargetRuntimeIdentifier $RuntimeIdentifier
$hostArchitecture = $topology.HostArchitecture
$targetArchitecture = $topology.TargetArchitecture
$targetOperatingSystem = $topology.TargetOperatingSystem
$useMuslContainer = $topology.UseMuslContainer
if (-not $useMuslContainer -and -not [string]::IsNullOrWhiteSpace($MuslBuildImage)) {
    throw 'MuslBuildImage is only valid for linux-musl targets.'
}

$repoRoot = [System.IO.Path]::GetFullPath(
    (Join-Path -Path $PSScriptRoot -ChildPath '..' -AdditionalChildPath '..')
)
$projectPath = Join-Path `
    -Path $repoRoot `
    -ChildPath 'src' `
    -AdditionalChildPath 'ghcfa-telem', 'ghcfa-telem.csproj'
$outputRootPath = if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    Join-Path $repoRoot 'artifacts'
}
else {
    [System.IO.Path]::GetFullPath($OutputRoot)
}
$restoreConfigFilePath = if ([string]::IsNullOrWhiteSpace($RestoreConfigFile)) {
    $null
}
else {
    [System.IO.Path]::GetFullPath($RestoreConfigFile)
}
if ($null -ne $restoreConfigFilePath -and -not (Test-Path -LiteralPath $restoreConfigFilePath -PathType Leaf)) {
    throw "Restore configuration file '$restoreConfigFilePath' does not exist."
}

$publishDirectory = Join-Path $outputRootPath 'publish' $RuntimeIdentifier
$packageDirectory = Join-Path $outputRootPath 'packages'
$stagingDirectory = Join-Path $outputRootPath 'staging' $RuntimeIdentifier
$runtimeStagingDirectory = Join-Path $stagingDirectory 'runtime'
$symbolsStagingDirectory = Join-Path $stagingDirectory 'symbols'
$executableName = if ($targetOperatingSystem -eq 'win') {
    'ghcfa-telem.exe'
}
else {
    'ghcfa-telem'
}
$nativeExecutable = Join-Path $publishDirectory $executableName
$buildProjectPath = $projectPath
$buildPublishDirectory = $publishDirectory
$buildRestoreConfigFile = $restoreConfigFilePath
$muslContainerArguments = @()
$muslPlatform = if ($targetArchitecture -eq 'x64') { 'linux/amd64' } else { 'linux/arm64' }
$muslRuntimeImage = 'mcr.microsoft.com/dotnet/runtime-deps:10.0-alpine3.23'

function Invoke-BuildDotNet {
    param([string[]] $Arguments)

    if ($useMuslContainer) {
        $credentialName = 'NuGetPackageSourceCredentials_azure-sdk-for-net'
        $previousCredentials = [Environment]::GetEnvironmentVariable($credentialName)
        $credentialArguments = @()
        try {
            if (-not [string]::IsNullOrWhiteSpace($previousCredentials) -or
                -not [string]::IsNullOrWhiteSpace($env:VSS_NUGET_ACCESSTOKEN)) {
                $configPath = if ($null -ne $restoreConfigFilePath) { $restoreConfigFilePath } else { Join-Path $repoRoot 'nuget.config' }
                $config = [xml](Get-Content -LiteralPath $configPath -Raw -ErrorAction Stop)
                $source = $config.SelectSingleNode('/configuration/packageSources/add[@key="azure-sdk-for-net"]')
                if ($null -ne $source) {
                    if ($source.GetAttribute('value') -ne 'https://pkgs.dev.azure.com/azure-sdk/public/_packaging/azure-sdk-for-net/nuget/v3/index.json') {
                        throw 'Refusing to forward Azure SDK credentials to an unexpected NuGet feed.'
                    }
                    if ([string]::IsNullOrWhiteSpace($previousCredentials)) {
                        [Environment]::SetEnvironmentVariable(
                            $credentialName,
                            "Username=AzureDevOps;Password=$env:VSS_NUGET_ACCESSTOKEN;ValidAuthenticationTypes=Basic"
                        )
                    }
                    $credentialArguments = @('--env', $credentialName)
                }
            }
            & docker @muslContainerArguments @credentialArguments --entrypoint dotnet $MuslBuildImage @Arguments
            if ($LASTEXITCODE -ne 0) {
                throw "dotnet $($Arguments[0]) failed with exit code $LASTEXITCODE."
            }
        }
        finally {
            $restoredCredentials = if ($null -eq $previousCredentials) { [NullString]::Value } else { $previousCredentials }
            [Environment]::SetEnvironmentVariable($credentialName, $restoredCredentials)
        }
    }
    else {
        & dotnet @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments[0]) failed with exit code $LASTEXITCODE."
    }
}

function Initialize-MuslContainer {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker was not found on PATH. Musl Native AOT builds require a matching-architecture Linux Docker engine.'
    }
    $daemon = & docker info --format '{{.OSType}}/{{.Architecture}}'
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to connect to the Docker engine; exit code $LASTEXITCODE."
    }
    $expectedDaemon = if ($targetArchitecture -eq 'x64') { '^linux/(x86_64|amd64)$' } else { '^linux/(aarch64|arm64)$' }
    if ($daemon -notmatch $expectedDaemon) {
        throw "Docker engine '$daemon' cannot natively build '$RuntimeIdentifier'. Cross-architecture emulation is not supported."
    }

    $checkoutRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '..'))
    if (-not (Test-Path -LiteralPath (Join-Path $checkoutRoot '.git') -PathType Container)) {
        throw 'Musl container builds require a full clone with .git inside the checkout for NBGV. Use a full clone rather than a linked worktree.'
    }
    $sdkVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'global.json') -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop).sdk.version
    if ([string]::IsNullOrWhiteSpace($MuslBuildImage)) {
        $script:MuslBuildImage = "ghcfa-telem-musl-build:$sdkVersion-$targetArchitecture"
        $contextPath = Join-Path $repoRoot 'eng' 'native-musl'
        & docker build --platform $muslPlatform --build-arg "DOTNET_SDK_VERSION=$sdkVersion" --tag $script:MuslBuildImage $contextPath
        if ($LASTEXITCODE -ne 0) {
            throw "Building the Alpine Native AOT toolchain image failed with exit code $LASTEXITCODE."
        }
    }

    $containerSdkVersion = & docker run --rm --platform $muslPlatform --entrypoint dotnet $MuslBuildImage --version
    if ($LASTEXITCODE -ne 0 -or $containerSdkVersion -ne $sdkVersion) {
        throw "Musl build image must provide .NET SDK '$sdkVersion'; found '$containerSdkVersion' (exit code $LASTEXITCODE)."
    }
    $containerInfo = & docker run --rm --platform $muslPlatform --entrypoint dotnet $MuslBuildImage --info
    if ($LASTEXITCODE -ne 0 -or
        ($containerInfo -join "`n") -notmatch "(?m)^\s*RID:\s*$([regex]::Escape($RuntimeIdentifier))\s*$") {
        throw "Musl build image does not provide target RID '$RuntimeIdentifier'; dotnet --info exited with $LASTEXITCODE."
    }

    $probe = @'
set -eu
command -v clang
command -v ld
command -v objcopy
command -v readelf
test -f /etc/alpine-release
printf '#include <stdlib.h>\n#include <zlib.h>\nint main(void) { void *p = malloc(1); free(p); return zlibVersion() == 0; }\n' > /tmp/musl-probe.c
clang -g /tmp/musl-probe.c -lz -o /tmp/musl-probe
/tmp/musl-probe
objcopy --only-keep-debug /tmp/musl-probe /tmp/musl-probe.dbg
test -s /tmp/musl-probe.dbg
readelf -l /tmp/musl-probe > /tmp/musl-probe.headers
grep -F 'ld-musl-' /tmp/musl-probe.headers
'@
    & docker run --rm --platform $muslPlatform --entrypoint sh $MuslBuildImage -c $probe
    if ($LASTEXITCODE -ne 0) {
        throw "Alpine compiler/linker, musl libc, zlib, or debug-symbol prerequisite validation failed with exit code $LASTEXITCODE."
    }

    $userId = & id -u
    if ($LASTEXITCODE -ne 0) { throw "Unable to read the build user ID; exit code $LASTEXITCODE." }
    $groupId = & id -g
    if ($LASTEXITCODE -ne 0) { throw "Unable to read the build group ID; exit code $LASTEXITCODE." }
    $script:muslContainerArguments = @(
        'run', '--rm', '--platform', $muslPlatform,
        '--user', "${userId}:${groupId}",
        '--mount', "type=bind,source=$checkoutRoot,target=/repo",
        '--mount', "type=bind,source=$outputRootPath,target=/artifacts",
        '--workdir', '/repo/telemetry-reporter',
        '--env', 'HOME=/tmp',
        '--env', "DOTNET_CLI_HOME=/artifacts/staging/$RuntimeIdentifier/dotnet",
        '--env', "NUGET_PACKAGES=/artifacts/staging/$RuntimeIdentifier/nuget",
        '--env', 'AZURE_MCP_COLLECT_TELEMETRY=false'
    )
    $script:buildProjectPath = '/repo/telemetry-reporter/src/ghcfa-telem/ghcfa-telem.csproj'
    $script:buildPublishDirectory = "/artifacts/publish/$RuntimeIdentifier"
    if ($null -ne $restoreConfigFilePath) {
        $script:muslContainerArguments += @(
            '--mount', "type=bind,source=$restoreConfigFilePath,target=/restore/nuget.config,readonly"
        )
        $script:buildRestoreConfigFile = '/restore/nuget.config'
    }
}

function Remove-DirectoryIfPresent {
    param(
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw 'A directory path is required.'
    }

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    }
}

function Get-MsvcInstallation {
    param(
        [string] $VsWherePath,
        [string] $HostArchitecture,
        [string] $TargetArchitecture
    )

    if ([string]::IsNullOrWhiteSpace($VsWherePath) -or
        [string]::IsNullOrWhiteSpace($HostArchitecture) -or
        [string]::IsNullOrWhiteSpace($TargetArchitecture)) {
        throw 'The Visual Studio locator path and host/target architectures are required.'
    }

    $candidateVersions = @{}
    $vsWhereOutput = & $VsWherePath -all -products '*' -format json
    if ($LASTEXITCODE -ne 0) {
        throw "vswhere.exe failed with exit code $LASTEXITCODE."
    }

    foreach ($installation in @($vsWhereOutput | ConvertFrom-Json -ErrorAction Stop)) {
        $candidateVersions[$installation.installationPath] =
            [version]$installation.installationVersion
    }

    $visualStudioRoot = Join-Path $env:ProgramFiles 'Microsoft Visual Studio'
    if (Test-Path -LiteralPath $visualStudioRoot) {
        foreach ($installationDirectory in Get-ChildItem -LiteralPath $visualStudioRoot -Directory -Recurse -Depth 1 -ErrorAction Stop) {
            $vcToolsPath = Join-Path $installationDirectory.FullName 'VC\Tools\MSVC'
            if (-not (Test-Path -LiteralPath $vcToolsPath)) {
                continue
            }

            $toolsetVersion = Get-ChildItem -LiteralPath $vcToolsPath -Directory -ErrorAction Stop |
                ForEach-Object {
                    $parsedVersion = $null
                    if ([version]::TryParse($_.Name, [ref]$parsedVersion)) {
                        $parsedVersion
                    }
                } |
                Sort-Object -Descending |
                Select-Object -First 1

            if ($null -ne $toolsetVersion -and
                -not $candidateVersions.ContainsKey($installationDirectory.FullName)) {
                $candidateVersions[$installationDirectory.FullName] = $toolsetVersion
            }
        }
    }

    $linkerPattern = "\\bin\\Host$([regex]::Escape($HostArchitecture))\\$([regex]::Escape($TargetArchitecture))\\link\.exe$"
    foreach ($candidate in $candidateVersions.GetEnumerator() |
        Sort-Object -Property Value -Descending) {
        $vcVarsAllPath = Join-Path $candidate.Key 'VC\Auxiliary\Build\vcvarsall.bat'
        $vcToolsPath = Join-Path $candidate.Key 'VC\Tools\MSVC'
        if (-not (Test-Path -LiteralPath $vcVarsAllPath) -or
            -not (Test-Path -LiteralPath $vcToolsPath)) {
            continue
        }

        $linker = Get-ChildItem -LiteralPath $vcToolsPath `
            -Filter 'link.exe' `
            -File `
            -Recurse `
            -ErrorAction SilentlyContinue |
            Where-Object FullName -Match $linkerPattern |
            Select-Object -First 1

        if ($null -ne $linker) {
            return [pscustomobject]@{
                InstallationPath = $candidate.Key
                Version = $candidate.Value
                VcVarsAllPath = $vcVarsAllPath
                LinkerPath = $linker.FullName
            }
        }
    }

    throw @"
No complete Visual Studio C++ toolchain was found for $HostArchitecture -> $TargetArchitecture.
Install the "Desktop development with C++" workload, the matching MSVC build tools,
and a Windows SDK, then run this script again.
"@
}

function Invoke-NativeCommand {
    param(
        [string[]] $Arguments,
        [int] $ExpectedExitCode
    )

    if ($null -eq $Arguments) {
        throw 'Native command arguments are required.'
    }

    $stderrPath = Join-Path $stagingDirectory "$([guid]::NewGuid().ToString('N')).stderr.txt"
    try {
        $stdout = if ($useMuslContainer) {
            & docker run --rm --platform $muslPlatform `
                --mount "type=bind,source=$publishDirectory,target=/publish,readonly" `
                --env 'AZURE_MCP_COLLECT_TELEMETRY=false' `
                --entrypoint /publish/ghcfa-telem $muslRuntimeImage @Arguments 2> $stderrPath
        }
        else {
            & $nativeExecutable @Arguments 2> $stderrPath
        }
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne $ExpectedExitCode) {
            $stderr = if (Test-Path -LiteralPath $stderrPath) {
                Get-Content -LiteralPath $stderrPath -Raw -ErrorAction Stop
            }
            else {
                ''
            }

            throw "Native command returned exit code $exitCode; expected $ExpectedExitCode.`n$stderr"
        }

        return ($stdout -join [Environment]::NewLine)
    }
    finally {
        Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Test-IsSymbolFile {
    param(
        [System.IO.FileInfo] $File
    )

    if ($null -eq $File) {
        throw 'A published file is required.'
    }

    if ($File.Extension -in @('.pdb', '.dbg')) {
        return $true
    }

    $relativePath = [System.IO.Path]::GetRelativePath($publishDirectory, $File.FullName)
    return @($relativePath -split '[\\/]' | Where-Object { $_.EndsWith('.dSYM', [System.StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
}

function Copy-PublishFiles {
    param(
        [scriptblock] $Include,
        [string] $Destination
    )

    if ($null -eq $Include -or [string]::IsNullOrWhiteSpace($Destination)) {
        throw 'A file filter and destination are required.'
    }

    foreach ($file in Get-ChildItem -LiteralPath $publishDirectory -File -Recurse -ErrorAction Stop) {
        if (-not (& $Include $file)) {
            continue
        }

        $relativePath = [System.IO.Path]::GetRelativePath($publishDirectory, $file.FullName)
        $destinationPath = Join-Path $Destination $relativePath
        $destinationParent = Split-Path -Parent $destinationPath
        New-Item -ItemType Directory -Path $destinationParent -Force -ErrorAction Stop | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destinationPath -ErrorAction Stop
    }
}

function Assert-PlatformPrerequisites {
    if ($useMuslContainer) {
        Initialize-MuslContainer
        return
    }
    if ($IsLinux) {
        if (-not (Get-Command clang -ErrorAction SilentlyContinue)) {
            throw 'clang was not found on PATH. Install the Native AOT compiler prerequisites and try again.'
        }

        if (-not (Get-Command objcopy -ErrorAction SilentlyContinue)) {
            throw 'objcopy was not found on PATH. Install binutils for Native AOT symbol extraction and try again.'
        }

        return
    }

    if ($IsMacOS) {
        if (-not (Get-Command xcrun -ErrorAction SilentlyContinue)) {
            throw 'xcrun was not found on PATH. Install Xcode command-line tools and try again.'
        }

        $null = & xcrun --find clang
        if ($LASTEXITCODE -ne 0) {
            throw "xcrun could not find clang; exit code $LASTEXITCODE."
        }

        $null = & xcrun --sdk macosx --show-sdk-path
        if ($LASTEXITCODE -ne 0) {
            throw "xcrun could not find the macOS SDK; exit code $LASTEXITCODE."
        }
    }
}

if (-not $useMuslContainer -and -not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'The .NET SDK was not found on PATH. Install the .NET 10 SDK and try again.'
}

Assert-PlatformPrerequisites

$msvcInstallation = $null
$vcVarsArgument = $null
$vsWhereDirectory = $null
if ($IsWindows) {
    $vsWherePath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $vsWherePath)) {
        throw "Visual Studio Installer's vswhere.exe was not found at '$vsWherePath'."
    }

    $msvcInstallation = Get-MsvcInstallation `
        -VsWherePath $vsWherePath `
        -HostArchitecture $hostArchitecture `
        -TargetArchitecture $targetArchitecture
    $vcVarsArgument = if ($hostArchitecture -eq $targetArchitecture) {
        $targetArchitecture
    }
    else {
        "${hostArchitecture}_${targetArchitecture}"
    }
    $vsWhereDirectory = Split-Path -Parent $vsWherePath

    Write-Host "Using MSVC toolchain: $($msvcInstallation.InstallationPath)"
    Write-Host "Using linker: $($msvcInstallation.LinkerPath)"
}

Write-Host "Host runtime identifier:   $currentRuntimeIdentifier"
Write-Host "Target runtime identifier: $RuntimeIdentifier"

Remove-DirectoryIfPresent -Path $publishDirectory
Remove-DirectoryIfPresent -Path $stagingDirectory
New-Item -ItemType Directory -Path $publishDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $packageDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $runtimeStagingDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $symbolsStagingDirectory -Force -ErrorAction Stop | Out-Null

if (-not $NoClean) {
    $cleanArguments = @(
        'clean',
        $buildProjectPath,
        '--configuration', $Configuration,
        '--runtime', $RuntimeIdentifier,
        "-p:RuntimeIdentifiers=$RuntimeIdentifier",
        '-p:BuildNative=true'
    )
    if ($null -ne $buildRestoreConfigFile) {
        $cleanArguments += "-p:RestoreConfigFile=$buildRestoreConfigFile"
    }

    Invoke-BuildDotNet -Arguments $cleanArguments
}

$publishArguments = @(
    'publish',
    $buildProjectPath,
    '--configuration', $Configuration,
    '--runtime', $RuntimeIdentifier,
    "-p:RuntimeIdentifiers=$RuntimeIdentifier",
    '--self-contained', 'true',
    '--output', $buildPublishDirectory,
    '-p:BuildNative=true'
)
if ($null -ne $buildRestoreConfigFile) {
    $publishArguments += "-p:RestoreConfigFile=$buildRestoreConfigFile"
}

if ($IsWindows) {
    $quotedPublishArguments = $publishArguments |
        ForEach-Object { '"' + $_.Replace('"', '""') + '"' }
    $nativeBuildCommand = @(
        "set `"PATH=$vsWhereDirectory;%PATH%`""
        "call `"$($msvcInstallation.VcVarsAllPath)`" $vcVarsArgument >nul"
        "cd /d `"$repoRoot`""
        "`"dotnet`" $($quotedPublishArguments -join ' ')"
    ) -join ' && '

    & $env:ComSpec /d /c $nativeBuildCommand
}
else {
    Invoke-BuildDotNet -Arguments $publishArguments
}

if ($LASTEXITCODE -ne 0) {
    throw "Native AOT publish failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $nativeExecutable)) {
    throw "Native publish did not produce '$nativeExecutable'."
}

$smokeTestsRan = $useMuslContainer -or $RuntimeIdentifier -eq $currentRuntimeIdentifier
if ($smokeTestsRan) {
    $previousTelemetrySetting = $env:AZURE_MCP_COLLECT_TELEMETRY
    $env:AZURE_MCP_COLLECT_TELEMETRY = 'false'
    try {
        $null = Invoke-NativeCommand -Arguments @('--help') -ExpectedExitCode 0

        $successOutput = Invoke-NativeCommand -Arguments @(
            '--timestamp', '2026-09-15T21:30:00Z',
            '--event-type', 'tool_invocation',
            '--session-id', '00000000-0000-4000-8000-000000000000',
            '--tool-name', 'azure-storage'
        ) -ExpectedExitCode 0
        $successResponse = $successOutput | ConvertFrom-Json -ErrorAction Stop
        if ($successResponse.status -ne 200) {
            throw "Native success smoke test returned status $($successResponse.status); expected 200."
        }

        $failureOutput = Invoke-NativeCommand -Arguments @(
            '--event-type', 'tool_invocation',
            '--session-id', '00000000-0000-4000-8000-000000000000'
        ) -ExpectedExitCode 1
        $failureResponse = $failureOutput | ConvertFrom-Json -ErrorAction Stop
        if ($failureResponse.status -ne 400) {
            throw "Native validation smoke test returned status $($failureResponse.status); expected 400."
        }
    }
    finally {
        $env:AZURE_MCP_COLLECT_TELEMETRY = $previousTelemetrySetting
    }
}
else {
    Write-Warning "Skipping smoke tests because target RID '$RuntimeIdentifier' cannot run on host RID '$currentRuntimeIdentifier'."
}

$versionOutput = Invoke-BuildDotNet -Arguments @(
    'msbuild', $buildProjectPath,
    '-nologo',
    '-t:GetBuildVersion',
    '-getProperty:NuGetPackageVersion'
)

$version = ($versionOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Last 1).Trim()
if ([string]::IsNullOrWhiteSpace($version)) {
    throw 'The evaluated NBGV package version was empty.'
}

$runtimeArchive = Join-Path $packageDirectory "ghcfa-telem-$version-$RuntimeIdentifier.zip"
$symbolsArchive = Join-Path $packageDirectory "ghcfa-telem-$version-$RuntimeIdentifier-symbols.zip"
foreach ($artifactPath in @(
    $runtimeArchive,
    $symbolsArchive,
    "$runtimeArchive.sha256",
    "$symbolsArchive.sha256"
)) {
    Remove-Item -LiteralPath $artifactPath -Force -ErrorAction SilentlyContinue
}

Copy-PublishFiles -Include { param($file) -not (Test-IsSymbolFile -File $file) } `
    -Destination $runtimeStagingDirectory
Copy-PublishFiles -Include { param($file) Test-IsSymbolFile -File $file } `
    -Destination $symbolsStagingDirectory

$runtimeFiles = @(Get-ChildItem -LiteralPath $runtimeStagingDirectory -File -Recurse -ErrorAction Stop)
if ($runtimeFiles.Count -eq 0) {
    throw 'The runtime package staging directory is empty.'
}

$stagedExecutable = Join-Path $runtimeStagingDirectory $executableName
if (-not (Test-Path -LiteralPath $stagedExecutable)) {
    throw "The runtime package did not contain '$executableName'."
}

$symbolFiles = @(Get-ChildItem -LiteralPath $symbolsStagingDirectory -File -Recurse -ErrorAction Stop)
if ($symbolFiles.Count -eq 0) {
    throw 'The symbols package staging directory is empty.'
}

$nativeSymbolFound = switch ($targetOperatingSystem) {
    'win' {
        $symbolFiles.Name -contains 'ghcfa-telem.pdb'
    }
    'linux' {
        $symbolFiles.Name -contains 'ghcfa-telem.dbg'
    }
    'osx' {
        @($symbolFiles | Where-Object {
            $relativePath = [System.IO.Path]::GetRelativePath($symbolsStagingDirectory, $_.FullName)
            @($relativePath -split '[\\/]' | Where-Object { $_ -eq 'ghcfa-telem.dSYM' }).Count -gt 0
        }).Count -gt 0
    }
}
if (-not $nativeSymbolFound) {
    throw "The native publish did not produce the expected $targetOperatingSystem symbol artifact for ghcfa-telem."
}

Compress-Archive -Path (Join-Path $runtimeStagingDirectory '*') `
    -DestinationPath $runtimeArchive `
    -CompressionLevel Optimal `
    -ErrorAction Stop
Compress-Archive -Path (Join-Path $symbolsStagingDirectory '*') `
    -DestinationPath $symbolsArchive `
    -CompressionLevel Optimal `
    -ErrorAction Stop

foreach ($archive in @($runtimeArchive, $symbolsArchive)) {
    $hash = Get-FileHash -LiteralPath $archive -Algorithm SHA256 -ErrorAction Stop
    "$($hash.Hash.ToLowerInvariant())  $([System.IO.Path]::GetFileName($archive))" |
        Set-Content -LiteralPath "$archive.sha256" -Encoding ascii -ErrorAction Stop
}

$null = Get-ValidatedNativePackage -ArchivePath $runtimeArchive -RuntimeIdentifier $RuntimeIdentifier
$null = Get-ValidatedNativePackage -ArchivePath $symbolsArchive -RuntimeIdentifier $RuntimeIdentifier -Symbols

Remove-DirectoryIfPresent -Path $stagingDirectory

Write-Host ''
Write-Host 'Native AOT build completed successfully.'
Write-Host "Publish directory: $publishDirectory"
Write-Host "Runtime archive:   $runtimeArchive"
Write-Host "Symbols archive:   $symbolsArchive"
if ($smokeTestsRan) {
    Write-Host 'Smoke tests:       passed'
}
else {
    Write-Host 'Smoke tests:       skipped (cross-compiled target)'
}
