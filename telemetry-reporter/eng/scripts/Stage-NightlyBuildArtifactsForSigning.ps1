#!/usr/bin/env pwsh
#Requires -Version 7
# Validates and expands unsigned nightly packages, then prepares Windows and macOS executables for the Azure SDK signing templates.
# Exit codes: 0 = success, 1 = validation or staging failure, 2 = usage or argument error.

[CmdletBinding()]
param(
    [string] $PipelineWorkspace,
    [string] $OutputPath,
    [string] $EntitlementsPath
)

Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($PipelineWorkspace) -or
    [string]::IsNullOrWhiteSpace($OutputPath)) {
    Write-Error 'PipelineWorkspace and OutputPath are required.'
    exit 2
}
if (-not (Test-Path -LiteralPath $PipelineWorkspace -PathType Container)) {
    Write-Error "Pipeline workspace '$PipelineWorkspace' does not exist."
    exit 2
}
if ([string]::IsNullOrWhiteSpace($EntitlementsPath)) {
    $EntitlementsPath = [System.IO.Path]::GetFullPath(
        (Join-Path -Path $PSScriptRoot -ChildPath '..' -AdditionalChildPath 'dotnet-executable-entitlements.plist')
    )
}
if (-not (Test-Path -LiteralPath $EntitlementsPath -PathType Leaf)) {
    Write-Error "Entitlements file '$EntitlementsPath' does not exist."
    exit 2
}

$runtimeIdentifiers = @(
    'win-x64',
    'win-arm64',
    'linux-x64',
    'linux-arm64',
    'osx-x64',
    'osx-arm64'
)

function Test-ArchiveChecksum {
    param(
        [System.IO.FileInfo] $Archive
    )

    if ($null -eq $Archive) {
        throw 'An archive is required for checksum validation.'
    }

    $checksumPath = "$($Archive.FullName).sha256"
    if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
        throw "Checksum file '$checksumPath' is missing."
    }

    $checksumLine = (Get-Content -LiteralPath $checksumPath -Raw -ErrorAction Stop).Trim()
    $checksumMatch = [regex]::Match($checksumLine, '^(?<hash>[0-9a-fA-F]{64})(?:\s+.+)?$')
    if (-not $checksumMatch.Success) {
        throw "Checksum file '$checksumPath' is malformed."
    }

    $actualHash = (Get-FileHash -LiteralPath $Archive.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
    if ($actualHash -ne $checksumMatch.Groups['hash'].Value) {
        throw "Checksum validation failed for '$($Archive.FullName)'."
    }
}

try {
    if (Test-Path -LiteralPath $OutputPath) {
        Remove-Item -LiteralPath $OutputPath -Recurse -Force -ErrorAction Stop
    }
    New-Item -ItemType Directory -Path $OutputPath -Force -ErrorAction Stop | Out-Null

    $symbolRoot = Join-Path $OutputPath 'symbols'
    New-Item -ItemType Directory -Path $symbolRoot -Force -ErrorAction Stop | Out-Null
    $passthroughRoot = Join-Path $OutputPath 'passthrough'
    New-Item -ItemType Directory -Path $passthroughRoot -Force -ErrorAction Stop | Out-Null

    $versions = @()
    foreach ($runtimeIdentifier in $runtimeIdentifiers) {
        $artifactDirectory = Join-Path $PipelineWorkspace "telemetry-reporter_unsigned_$runtimeIdentifier"
        if (-not (Test-Path -LiteralPath $artifactDirectory -PathType Container)) {
            throw "Unsigned artifact directory '$artifactDirectory' was not downloaded."
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

        Test-ArchiveChecksum -Archive $runtimeArchives[0]
        Test-ArchiveChecksum -Archive $symbolArchives[0]

        $versionMatch = [regex]::Match(
            $runtimeArchives[0].Name,
            "^ghcfa-telem-(?<version>.+)-$([regex]::Escape($runtimeIdentifier))\.zip$"
        )
        if (-not $versionMatch.Success) {
            throw "Unable to parse the version from '$($runtimeArchives[0].Name)'."
        }
        $versions += $versionMatch.Groups['version'].Value

        $runtimeDirectory = Join-Path $OutputPath $runtimeIdentifier
        New-Item -ItemType Directory -Path $runtimeDirectory -Force -ErrorAction Stop | Out-Null
        Expand-Archive -LiteralPath $runtimeArchives[0].FullName `
            -DestinationPath $runtimeDirectory `
            -Force `
            -ErrorAction Stop

        $executableName = if ($runtimeIdentifier.StartsWith('win-', [System.StringComparison]::Ordinal)) {
            'ghcfa-telem.exe'
        }
        else {
            'ghcfa-telem'
        }
        $executablePath = Join-Path $runtimeDirectory $executableName
        if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
            throw "Runtime archive '$($runtimeArchives[0].Name)' does not contain '$executableName'."
        }

        $symbolDirectory = Join-Path $symbolRoot $runtimeIdentifier
        New-Item -ItemType Directory -Path $symbolDirectory -Force -ErrorAction Stop | Out-Null
        Copy-Item -LiteralPath $symbolArchives[0].FullName `
            -Destination (Join-Path $symbolDirectory $symbolArchives[0].Name) `
            -ErrorAction Stop

        if ($runtimeIdentifier.StartsWith('linux-', [System.StringComparison]::Ordinal)) {
            $passthroughDirectory = Join-Path $passthroughRoot $runtimeIdentifier
            New-Item -ItemType Directory -Path $passthroughDirectory -Force -ErrorAction Stop | Out-Null
            Copy-Item -LiteralPath $runtimeArchives[0].FullName `
                -Destination (Join-Path $passthroughDirectory $runtimeArchives[0].Name) `
                -ErrorAction Stop
        }
        elseif ($runtimeIdentifier.StartsWith('osx-', [System.StringComparison]::Ordinal)) {
            if (-not $IsMacOS) {
                throw 'macOS artifacts must be staged on a macOS host.'
            }

            & chmod '+x' $executablePath
            if ($LASTEXITCODE -ne 0) {
                throw "chmod failed for '$executablePath' with exit code $LASTEXITCODE."
            }

            & codesign --deep -s - -f --options runtime --entitlements $EntitlementsPath $executablePath
            if ($LASTEXITCODE -ne 0) {
                throw "Ad-hoc codesign failed for '$executablePath' with exit code $LASTEXITCODE."
            }

            & codesign -d --entitlements ':-' $executablePath
            if ($LASTEXITCODE -ne 0) {
                throw "Unable to inspect staged entitlements for '$executablePath'; codesign exited with $LASTEXITCODE."
            }

            $signingArchive = Join-Path $runtimeDirectory "$executableName.zip"
            Compress-Archive -LiteralPath $executablePath `
                -DestinationPath $signingArchive `
                -CompressionLevel Optimal `
                -ErrorAction Stop
            Remove-Item -LiteralPath $executablePath -Force -ErrorAction Stop
        }
    }

    $uniqueVersions = @($versions | Sort-Object -Unique)
    if ($uniqueVersions.Count -ne 1) {
        throw "Expected one package version across the matrix; found: $($uniqueVersions -join ', ')."
    }

    [ordered]@{
        version = $uniqueVersions[0]
        runtimeIdentifiers = $runtimeIdentifiers
    } |
        ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath (Join-Path $OutputPath 'signing-info.json') -Encoding utf8 -ErrorAction Stop
}
catch {
    Write-Error $_
    exit 1
}
