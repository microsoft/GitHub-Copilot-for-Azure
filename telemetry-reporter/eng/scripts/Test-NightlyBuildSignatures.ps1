#!/usr/bin/env pwsh
#Requires -Version 7
# Verifies Authenticode or Apple code signatures in final nightly runtime packages on the matching host operating system.
# Exit codes: 0 = success, 1 = signature or package validation failed, 2 = usage, argument, or host-platform error.

[CmdletBinding()]
param(
    [string] $PipelineWorkspace,

    [ValidateSet('Windows', 'macOS')]
    [string] $Platform
)

Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($PipelineWorkspace) -or
    [string]::IsNullOrWhiteSpace($Platform)) {
    Write-Error 'PipelineWorkspace and Platform are required.'
    exit 2
}
if (-not (Test-Path -LiteralPath $PipelineWorkspace -PathType Container)) {
    Write-Error "Pipeline workspace '$PipelineWorkspace' does not exist."
    exit 2
}
if (($Platform -eq 'Windows' -and -not $IsWindows) -or
    ($Platform -eq 'macOS' -and -not $IsMacOS)) {
    Write-Error "Platform '$Platform' must be verified on a matching host."
    exit 2
}

$runtimeIdentifiers = if ($Platform -eq 'Windows') {
    @('win-x64', 'win-arm64')
}
else {
    @('osx-x64', 'osx-arm64')
}
$executableName = if ($Platform -eq 'Windows') {
    'ghcfa-telem.exe'
}
else {
    'ghcfa-telem'
}
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ghcfa-signature-verification-$([guid]::NewGuid().ToString('N'))"

try {
    New-Item -ItemType Directory -Path $temporaryRoot -Force -ErrorAction Stop | Out-Null

    foreach ($runtimeIdentifier in $runtimeIdentifiers) {
        $artifactDirectory = Join-Path $PipelineWorkspace "telemetry-reporter_$runtimeIdentifier"
        if (-not (Test-Path -LiteralPath $artifactDirectory -PathType Container)) {
            throw "Final artifact directory '$artifactDirectory' was not downloaded."
        }

        $runtimeArchives = @(
            Get-ChildItem -LiteralPath $artifactDirectory -File -Filter "ghcfa-telem-*-$runtimeIdentifier.zip"
        )
        if ($runtimeArchives.Count -ne 1) {
            throw "Expected one final runtime archive for '$runtimeIdentifier'."
        }

        $extractDirectory = Join-Path $temporaryRoot $runtimeIdentifier
        Expand-Archive -LiteralPath $runtimeArchives[0].FullName `
            -DestinationPath $extractDirectory `
            -Force `
            -ErrorAction Stop
        $executablePath = Join-Path $extractDirectory $executableName
        if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
            throw "Runtime archive '$($runtimeArchives[0].Name)' does not contain '$executableName'."
        }

        if ($Platform -eq 'Windows') {
            $signature = Get-AuthenticodeSignature -FilePath $executablePath
            if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
                throw "Authenticode signature for '$runtimeIdentifier' is '$($signature.Status)': $($signature.StatusMessage)"
            }

            Write-Host "Authenticode signature is valid for '$runtimeIdentifier'."
        }
        else {
            & codesign --verify --deep --strict --verbose=2 $executablePath
            if ($LASTEXITCODE -ne 0) {
                throw "Apple signature verification failed for '$runtimeIdentifier'; codesign exited with $LASTEXITCODE."
            }

            & codesign --display --verbose=4 $executablePath
            if ($LASTEXITCODE -ne 0) {
                throw "Unable to display Apple signature details for '$runtimeIdentifier'; codesign exited with $LASTEXITCODE."
            }

            Write-Host "Apple code signature is valid for '$runtimeIdentifier'."
        }
    }
}
catch {
    Write-Error $_
    exit 1
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
