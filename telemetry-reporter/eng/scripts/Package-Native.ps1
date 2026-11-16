#!/usr/bin/env pwsh
#Requires -Version 7
# Packages a published Native AOT executable and its symbols into validated archives with SHA-256 checksums.
# Exit codes: 0 = success, 1 = validation or packaging failure.

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('win-x64', 'win-arm64', 'linux-x64', 'linux-arm64', 'linux-musl-x64', 'linux-musl-arm64', 'osx-x64', 'osx-arm64')]
    [string] $RuntimeIdentifier,

    [Parameter(Mandatory)]
    [string] $OutputRoot,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9A-Za-z][0-9A-Za-z.+-]*$')]
    [string] $Version
)

Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'NativePackaging.psm1') -Force -ErrorAction Stop

$outputRootPath = [System.IO.Path]::GetFullPath($OutputRoot)
$publishDirectory = Join-Path $outputRootPath 'publish' $RuntimeIdentifier
$packageDirectory = Join-Path $outputRootPath 'packages'
$stagingDirectory = Join-Path $outputRootPath 'staging' $RuntimeIdentifier
$runtimeStagingDirectory = Join-Path $stagingDirectory 'runtime'
$symbolsStagingDirectory = Join-Path $stagingDirectory 'symbols'
$targetOperatingSystem = $RuntimeIdentifier.Split('-')[0]
$executableName = if ($targetOperatingSystem -eq 'win') {
    'ghcfa-telem.exe'
}
else {
    'ghcfa-telem'
}

if (-not (Test-Path -LiteralPath $publishDirectory -PathType Container)) {
    throw "Native publish directory '$publishDirectory' does not exist."
}
$nativeExecutable = Join-Path $publishDirectory $executableName
if (-not (Test-Path -LiteralPath $nativeExecutable -PathType Leaf)) {
    throw "Native publish did not produce '$nativeExecutable'."
}

if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction Stop
}
New-Item -ItemType Directory -Path $runtimeStagingDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $symbolsStagingDirectory -Force -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $packageDirectory -Force -ErrorAction Stop | Out-Null

function Test-IsSymbolFile {
    param([System.IO.FileInfo] $File)

    if ($File.Extension -in @('.pdb', '.dbg')) {
        return $true
    }

    $relativePath = [System.IO.Path]::GetRelativePath($publishDirectory, $File.FullName)
    return @($relativePath -split '[\\/]' | Where-Object {
        $_.EndsWith('.dSYM', [System.StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0
}

function Copy-PublishFiles {
    param(
        [scriptblock] $Include,
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

Copy-PublishFiles -Include { param($file) -not (Test-IsSymbolFile -File $file) } `
    -Destination $runtimeStagingDirectory
Copy-PublishFiles -Include { param($file) Test-IsSymbolFile -File $file } `
    -Destination $symbolsStagingDirectory

$runtimeFiles = @(Get-ChildItem -LiteralPath $runtimeStagingDirectory -File -Recurse -ErrorAction Stop)
if ($runtimeFiles.Count -eq 0) {
    throw 'The runtime package staging directory is empty.'
}
if (-not (Test-Path -LiteralPath (Join-Path $runtimeStagingDirectory $executableName) -PathType Leaf)) {
    throw "The runtime package did not contain '$executableName'."
}

$symbolFiles = @(Get-ChildItem -LiteralPath $symbolsStagingDirectory -File -Recurse -ErrorAction Stop)
if ($symbolFiles.Count -eq 0) {
    throw 'The symbols package staging directory is empty.'
}
$nativeSymbolFound = switch ($targetOperatingSystem) {
    'win' { $symbolFiles.Name -contains 'ghcfa-telem.pdb' }
    'linux' { $symbolFiles.Name -contains 'ghcfa-telem.dbg' }
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

$runtimeArchive = Join-Path $packageDirectory "ghcfa-telem-$Version-$RuntimeIdentifier.zip"
$symbolsArchive = Join-Path $packageDirectory "ghcfa-telem-$Version-$RuntimeIdentifier-symbols.zip"
foreach ($archive in @($runtimeArchive, $symbolsArchive)) {
    foreach ($path in @($archive, "$archive.sha256")) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction Stop
        }
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

$null = Get-ValidatedNativePackage -ArchivePath $runtimeArchive -RuntimeIdentifier $RuntimeIdentifier
$null = Get-ValidatedNativePackage -ArchivePath $symbolsArchive -RuntimeIdentifier $RuntimeIdentifier -Symbols
Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction Stop
$packageVersionPath = Join-Path $outputRootPath 'package-version.txt'
if (Test-Path -LiteralPath $packageVersionPath) {
    Remove-Item -LiteralPath $packageVersionPath -Force -ErrorAction Stop
}

Write-Host ''
Write-Host 'Native AOT packaging completed successfully.'
Write-Host "Runtime archive: $runtimeArchive"
Write-Host "Symbols archive: $symbolsArchive"
