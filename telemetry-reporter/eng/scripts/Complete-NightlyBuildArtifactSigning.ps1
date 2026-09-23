#!/usr/bin/env pwsh
#Requires -Version 7
# Expands signed macOS executables, verifies their signatures, and rebuilds the final nightly runtime and symbol packages with new checksums.
# Exit codes: 0 = success, 1 = validation or packaging failure, 2 = usage or argument error.

[CmdletBinding()]
param(
    [string] $SigningPath,
    [string] $OutputPath
)

Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($SigningPath) -or
    [string]::IsNullOrWhiteSpace($OutputPath)) {
    Write-Error 'SigningPath and OutputPath are required.'
    exit 2
}
if (-not (Test-Path -LiteralPath $SigningPath -PathType Container)) {
    Write-Error "Signing path '$SigningPath' does not exist."
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

function Write-ArchiveChecksum {
    param(
        [string] $ArchivePath
    )

    if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
        throw "Archive '$ArchivePath' does not exist."
    }

    $hash = Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256 -ErrorAction Stop
    "$($hash.Hash.ToLowerInvariant())  $([System.IO.Path]::GetFileName($ArchivePath))" |
        Set-Content -LiteralPath "$ArchivePath.sha256" -Encoding ascii -ErrorAction Stop
}

try {
    $signingInfoPath = Join-Path $SigningPath 'signing-info.json'
    if (-not (Test-Path -LiteralPath $signingInfoPath -PathType Leaf)) {
        throw "Signing metadata '$signingInfoPath' is missing."
    }

    $signingInfo = Get-Content -LiteralPath $signingInfoPath -Raw -ErrorAction Stop |
        ConvertFrom-Json -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace([string]$signingInfo.version)) {
        throw "Signing metadata '$signingInfoPath' does not contain a version."
    }

    $metadataRuntimeIdentifiers = @($signingInfo.runtimeIdentifiers)
    if (@(Compare-Object -ReferenceObject $runtimeIdentifiers -DifferenceObject $metadataRuntimeIdentifiers).Count -ne 0) {
        throw "Signing metadata '$signingInfoPath' does not contain the expected runtime identifier set."
    }

    if (Test-Path -LiteralPath $OutputPath) {
        Remove-Item -LiteralPath $OutputPath -Recurse -Force -ErrorAction Stop
    }
    New-Item -ItemType Directory -Path $OutputPath -Force -ErrorAction Stop | Out-Null

    foreach ($runtimeIdentifier in $runtimeIdentifiers) {
        $runtimeDirectory = Join-Path $SigningPath $runtimeIdentifier
        if (-not (Test-Path -LiteralPath $runtimeDirectory -PathType Container)) {
            throw "Signed runtime directory '$runtimeDirectory' is missing."
        }

        $executableName = if ($runtimeIdentifier.StartsWith('win-', [System.StringComparison]::Ordinal)) {
            'ghcfa-telem.exe'
        }
        else {
            'ghcfa-telem'
        }

        if ($runtimeIdentifier.StartsWith('osx-', [System.StringComparison]::Ordinal)) {
            if (-not $IsMacOS) {
                throw 'macOS artifacts must be completed on a macOS host.'
            }

            $signingArchives = @(Get-ChildItem -LiteralPath $runtimeDirectory -File -Filter "$executableName.zip")
            if ($signingArchives.Count -ne 1) {
                throw "Expected one signed macOS archive in '$runtimeDirectory'."
            }

            Expand-Archive -LiteralPath $signingArchives[0].FullName `
                -DestinationPath $runtimeDirectory `
                -Force `
                -ErrorAction Stop
            Remove-Item -LiteralPath $signingArchives[0].FullName -Force -ErrorAction Stop
        }

        $executablePath = Join-Path $runtimeDirectory $executableName
        if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
            throw "Signed runtime directory '$runtimeDirectory' does not contain '$executableName'."
        }

        if ($runtimeIdentifier.StartsWith('osx-', [System.StringComparison]::Ordinal)) {
            & codesign --verify --deep --strict --verbose=2 $executablePath
            if ($LASTEXITCODE -ne 0) {
                throw "Signature verification failed for '$executablePath'; codesign exited with $LASTEXITCODE."
            }
        }

        $symbolDirectory = Join-Path (Join-Path $SigningPath 'symbols') $runtimeIdentifier
        $symbolArchives = @(
            Get-ChildItem -LiteralPath $symbolDirectory `
                -File `
                -Filter "ghcfa-telem-*-$runtimeIdentifier-symbols.zip" `
                -ErrorAction Stop
        )
        if ($symbolArchives.Count -ne 1) {
            throw "Expected one symbols archive for '$runtimeIdentifier'."
        }

        $finalDirectory = Join-Path $OutputPath $runtimeIdentifier
        New-Item -ItemType Directory -Path $finalDirectory -Force -ErrorAction Stop | Out-Null

        $runtimeArchive = Join-Path $finalDirectory "ghcfa-telem-$($signingInfo.version)-$runtimeIdentifier.zip"
        $symbolArchive = Join-Path $finalDirectory $symbolArchives[0].Name
        if ($runtimeIdentifier.StartsWith('linux-', [System.StringComparison]::Ordinal)) {
            $passthroughDirectory = Join-Path (Join-Path $SigningPath 'passthrough') $runtimeIdentifier
            $passthroughArchives = @(
                Get-ChildItem -LiteralPath $passthroughDirectory `
                    -File `
                    -Filter "ghcfa-telem-*-$runtimeIdentifier.zip" `
                    -ErrorAction Stop
            )
            if ($passthroughArchives.Count -ne 1) {
                throw "Expected one Linux pass-through archive for '$runtimeIdentifier'."
            }

            Copy-Item -LiteralPath $passthroughArchives[0].FullName `
                -Destination $runtimeArchive `
                -ErrorAction Stop
        }
        else {
            Compress-Archive -Path (Join-Path $runtimeDirectory '*') `
                -DestinationPath $runtimeArchive `
                -CompressionLevel Optimal `
                -ErrorAction Stop
        }
        Copy-Item -LiteralPath $symbolArchives[0].FullName -Destination $symbolArchive -ErrorAction Stop

        Write-ArchiveChecksum -ArchivePath $runtimeArchive
        Write-ArchiveChecksum -ArchivePath $symbolArchive
    }
}
catch {
    Write-Error $_
    exit 1
}
