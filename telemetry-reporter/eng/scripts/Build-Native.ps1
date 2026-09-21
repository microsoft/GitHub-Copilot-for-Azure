#!/usr/bin/env pwsh
#Requires -Version 7

[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string] $Configuration = 'Release',

    [string] $OutputRoot,

    [switch] $NoClean
)

Set-StrictMode -Version Latest

if (-not $IsWindows) {
    throw 'The Native AOT build currently supports Windows x64 only.'
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$projectPath = Join-Path $repoRoot 'src\ghcfa-telem\ghcfa-telem.csproj'
$outputRootPath = if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    Join-Path $repoRoot 'artifacts'
}
else {
    [System.IO.Path]::GetFullPath($OutputRoot)
}

$publishDirectory = Join-Path $outputRootPath 'publish\win-x64'
$packageDirectory = Join-Path $outputRootPath 'packages'
$stagingDirectory = Join-Path $outputRootPath 'staging'
$runtimeStagingDirectory = Join-Path $stagingDirectory 'runtime'
$symbolsStagingDirectory = Join-Path $stagingDirectory 'symbols'

function Remove-DirectoryIfPresent {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    }
}

function Get-MsvcInstallation {
    param(
        [Parameter(Mandatory)]
        [string] $VsWherePath
    )

    $candidateVersions = @{}
    $vsWhereOutput = & $VsWherePath -all -products '*' -format json
    if ($LASTEXITCODE -ne 0) {
        throw "vswhere.exe failed with exit code $LASTEXITCODE."
    }

    foreach ($installation in ($vsWhereOutput | ConvertFrom-Json -ErrorAction Stop)) {
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

    foreach ($candidate in $candidateVersions.GetEnumerator() |
        Sort-Object -Property Value -Descending) {
        $vcVars64Path = Join-Path $candidate.Key 'VC\Auxiliary\Build\vcvars64.bat'
        $vcVarsAllPath = Join-Path $candidate.Key 'VC\Auxiliary\Build\vcvarsall.bat'
        $linker = Get-ChildItem (Join-Path $candidate.Key 'VC\Tools\MSVC') `
            -Filter 'link.exe' `
            -File `
            -Recurse `
            -ErrorAction SilentlyContinue |
            Where-Object FullName -Match '\\bin\\Hostx64\\x64\\link\.exe$' |
            Select-Object -First 1

        if ((Test-Path -LiteralPath $vcVars64Path) -and
            (Test-Path -LiteralPath $vcVarsAllPath) -and
            $null -ne $linker) {
            return [pscustomobject]@{
                InstallationPath = $candidate.Key
                Version = $candidate.Value
                VcVars64Path = $vcVars64Path
                LinkerPath = $linker.FullName
            }
        }
    }

    throw @'
No complete Visual Studio C++ x64 toolchain was found.
Install the "Desktop development with C++" workload, including MSVC x64/x86 build tools
and a Windows SDK, then run this script again.
'@
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)]
        [string[]] $Arguments,

        [Parameter(Mandatory)]
        [int] $ExpectedExitCode
    )

    $stderrPath = Join-Path $stagingDirectory "$([guid]::NewGuid().ToString('N')).stderr.txt"
    try {
        $stdout = & $nativeExecutable @Arguments 2> $stderrPath
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

function Copy-PublishFiles {
    param(
        [Parameter(Mandatory)]
        [scriptblock] $Include,

        [Parameter(Mandatory)]
        [string] $Destination
    )

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

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'The .NET SDK was not found on PATH. Install the .NET 10 SDK and try again.'
}

$vsWherePath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vsWherePath)) {
    throw "Visual Studio Installer's vswhere.exe was not found at '$vsWherePath'."
}

$msvcInstallation = Get-MsvcInstallation -VsWherePath $vsWherePath
Write-Host "Using MSVC toolchain: $($msvcInstallation.InstallationPath)"
Write-Host "Using linker: $($msvcInstallation.LinkerPath)"

if (-not $NoClean) {
    & dotnet clean $projectPath `
        --configuration $Configuration `
        --runtime win-x64 `
        -p:Platform=x64 `
        -p:BuildNative=true

    if ($LASTEXITCODE -ne 0) {
        throw "dotnet clean failed with exit code $LASTEXITCODE."
    }
}

Remove-DirectoryIfPresent -Path $publishDirectory
Remove-DirectoryIfPresent -Path $stagingDirectory
New-Item -ItemType Directory -Path $publishDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $packageDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $runtimeStagingDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $symbolsStagingDirectory -Force -ErrorAction Stop | Out-Null

$vsWhereDirectory = Split-Path -Parent $vsWherePath
$publishCommand = @(
    'dotnet publish'
    "`"$projectPath`""
    "--configuration $Configuration"
    '--runtime win-x64'
    '--self-contained true'
    "-o `"$publishDirectory`""
    '-p:BuildNative=true'
) -join ' '

$nativeBuildCommand = @(
    "set `"PATH=$vsWhereDirectory;%PATH%`""
    "call `"$($msvcInstallation.VcVars64Path)`" >nul"
    "cd /d `"$repoRoot`""
    $publishCommand
) -join ' && '

& $env:ComSpec /d /c $nativeBuildCommand
if ($LASTEXITCODE -ne 0) {
    throw "Native AOT publish failed with exit code $LASTEXITCODE."
}

$nativeExecutable = Join-Path $publishDirectory 'ghcfa-telem.exe'
if (-not (Test-Path -LiteralPath $nativeExecutable)) {
    throw "Native publish did not produce '$nativeExecutable'."
}

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

$versionOutput = & dotnet msbuild $projectPath `
    -nologo `
    -t:GetBuildVersion `
    -getProperty:NuGetPackageVersion
if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the NBGV package version; dotnet msbuild exited with $LASTEXITCODE."
}

$version = ($versionOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Last 1).Trim()
if ([string]::IsNullOrWhiteSpace($version)) {
    throw 'The evaluated NBGV package version was empty.'
}

$runtimeArchive = Join-Path $packageDirectory "ghcfa-telem-$version-win-x64.zip"
$symbolsArchive = Join-Path $packageDirectory "ghcfa-telem-$version-win-x64-symbols.zip"
foreach ($artifactPath in @(
    $runtimeArchive,
    $symbolsArchive,
    "$runtimeArchive.sha256",
    "$symbolsArchive.sha256"
)) {
    Remove-Item -LiteralPath $artifactPath -Force -ErrorAction SilentlyContinue
}

Copy-PublishFiles -Include { param($file) $file.Extension -ne '.pdb' } `
    -Destination $runtimeStagingDirectory
Copy-PublishFiles -Include { param($file) $file.Extension -eq '.pdb' } `
    -Destination $symbolsStagingDirectory

$runtimeFiles = @(Get-ChildItem -LiteralPath $runtimeStagingDirectory -File -Recurse -ErrorAction Stop)
if ($runtimeFiles.Count -eq 0) {
    throw 'The runtime package staging directory is empty.'
}

$symbolFiles = @(Get-ChildItem -LiteralPath $symbolsStagingDirectory -File -Recurse -ErrorAction Stop)
$expectedSymbols = @('ghcfa-telem.pdb', 'Ghcfa.Telemetry.pdb')
foreach ($expectedSymbol in $expectedSymbols) {
    if ($symbolFiles.Name -notcontains $expectedSymbol) {
        throw "The native publish did not produce expected symbol file '$expectedSymbol'."
    }
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

Remove-DirectoryIfPresent -Path $stagingDirectory

Write-Host ''
Write-Host 'Native AOT build completed successfully.'
Write-Host "Publish directory: $publishDirectory"
Write-Host "Runtime archive:   $runtimeArchive"
Write-Host "Symbols archive:   $symbolsArchive"
