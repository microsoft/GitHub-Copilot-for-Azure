#!/usr/bin/env pwsh
#Requires -Version 7
# Validates all downloaded nightly runtime and symbol archives against their SHA-256 sidecars and writes the consolidated build manifest published by the pipeline.
# Exit codes: 0 = success, 1 = artifact validation failed, 2 = invalid arguments.

[CmdletBinding()]
param(
    [string] $PipelineWorkspace,
    [string] $ManifestPath,
    [string] $BuildId,
    [string] $SourceVersion
)

Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($PipelineWorkspace) -or
    [string]::IsNullOrWhiteSpace($ManifestPath) -or
    [string]::IsNullOrWhiteSpace($BuildId) -or
    [string]::IsNullOrWhiteSpace($SourceVersion)) {
    Write-Error 'PipelineWorkspace, ManifestPath, BuildId, and SourceVersion are required.'
    exit 2
}
if (-not (Test-Path -LiteralPath $PipelineWorkspace -PathType Container)) {
    Write-Error "Pipeline workspace '$PipelineWorkspace' does not exist."
    exit 2
}

$runtimeIdentifiers = @(
    'win-x64',
    'win-arm64',
    'osx-x64',
    'osx-arm64',
    'linux-x64',
    'linux-arm64'
)
$manifestFiles = @()
$versions = @()

try {
    foreach ($runtimeIdentifier in $runtimeIdentifiers) {
        $artifactDirectory = Join-Path $PipelineWorkspace "telemetry-reporter_$runtimeIdentifier"
        if (-not (Test-Path -LiteralPath $artifactDirectory -PathType Container)) {
            throw "Artifact directory '$artifactDirectory' was not downloaded."
        }

        $runtimeArchives = @(
            Get-ChildItem -LiteralPath $artifactDirectory -File -Filter "ghcfa-telem-*-$runtimeIdentifier.zip"
        )
        $symbolArchives = @(
            Get-ChildItem -LiteralPath $artifactDirectory -File -Filter "ghcfa-telem-*-$runtimeIdentifier-symbols.zip"
        )
        if ($runtimeArchives.Count -ne 1 -or $symbolArchives.Count -ne 1) {
            throw "Expected one runtime and one symbols archive for '$runtimeIdentifier'."
        }

        foreach ($archive in @($runtimeArchives[0], $symbolArchives[0])) {
            $checksumPath = "$($archive.FullName).sha256"
            if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
                throw "Checksum file '$checksumPath' is missing."
            }

            $checksumLine = (Get-Content -LiteralPath $checksumPath -Raw -ErrorAction Stop).Trim()
            $expectedHash = ($checksumLine -split '\s+', 2)[0]
            $actualHash = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
            if ($actualHash -ne $expectedHash.ToLowerInvariant()) {
                throw "Checksum validation failed for '$($archive.Name)'."
            }

            $manifestFiles += [ordered]@{
                runtimeIdentifier = $runtimeIdentifier
                file = $archive.Name
                sha256 = $actualHash
            }
        }

        $versionMatch = [regex]::Match(
            $runtimeArchives[0].Name,
            "^ghcfa-telem-(.+)-$([regex]::Escape($runtimeIdentifier))\.zip$"
        )
        if (-not $versionMatch.Success) {
            throw "Unable to parse the version from '$($runtimeArchives[0].Name)'."
        }
        $versions += $versionMatch.Groups[1].Value
    }

    $uniqueVersions = @($versions | Sort-Object -Unique)
    if ($uniqueVersions.Count -ne 1) {
        throw "Expected one package version across the matrix; found: $($uniqueVersions -join ', ')."
    }

    $manifestDirectory = Split-Path -Parent $ManifestPath
    New-Item -ItemType Directory -Path $manifestDirectory -Force -ErrorAction Stop | Out-Null
    [ordered]@{
        buildId = $BuildId
        sourceVersion = $SourceVersion
        version = $uniqueVersions[0]
        runtimeIdentifiers = $runtimeIdentifiers
        files = $manifestFiles
    } |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath $ManifestPath -Encoding utf8 -ErrorAction Stop
}
catch {
    Write-Error $_
    exit 1
}
