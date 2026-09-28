#!/usr/bin/env pwsh
#Requires -Version 7
# Validates nightly telemetry reporter artifacts, creates a GitHub release, and uploads the six runtime archives.
# Exit codes: 0 = success, 1 = artifact validation or GitHub release failure, 2 = invalid arguments.

[CmdletBinding()]
param(
    [string] $PipelineWorkspace,
    [string] $ManifestPath,
    [string] $Repository = 'microsoft/GitHub-Copilot-for-Azure',
    [string] $ExpectedBuildId,
    [string] $ExpectedSourceVersion,
    [switch] $DryRun
)

Set-StrictMode -Version Latest

$runtimeIdentifiers = @(
    'win-x64',
    'win-arm64',
    'osx-x64',
    'osx-arm64',
    'linux-x64',
    'linux-arm64'
)

function Invoke-GitHubCli {
    param(
        [string[]] $Arguments
    )

    & gh @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Arguments[0..2] -join ' ') failed with exit code $LASTEXITCODE."
    }
}

if ([string]::IsNullOrWhiteSpace($PipelineWorkspace) -or
    [string]::IsNullOrWhiteSpace($ManifestPath) -or
    [string]::IsNullOrWhiteSpace($Repository)) {
    Write-Error 'PipelineWorkspace, ManifestPath, and Repository are required.'
    exit 2
}
if (-not (Test-Path -LiteralPath $PipelineWorkspace -PathType Container)) {
    Write-Error "Pipeline workspace '$PipelineWorkspace' does not exist."
    exit 2
}
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    Write-Error "Build manifest '$ManifestPath' does not exist."
    exit 2
}
if ($Repository -notmatch '^[^/\s]+/[^/\s]+$') {
    Write-Error "Repository '$Repository' must use the owner/name format."
    exit 2
}
if (-not $DryRun -and -not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error 'GitHub CLI was not found on PATH.'
    exit 1
}
if (-not $DryRun -and [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
    Write-Error 'GH_TOKEN is required to create the GitHub release.'
    exit 1
}

try {
    $manifest = Get-Content -LiteralPath $ManifestPath -Raw -ErrorAction Stop |
        ConvertFrom-Json -ErrorAction Stop
    $version = [string] $manifest.version
    $releaseTag = [string] $manifest.releaseTag
    $buildId = [string] $manifest.buildId
    $buildReason = [string] $manifest.buildReason
    $sourceVersion = [string] $manifest.sourceVersion
    if ($buildId -notmatch '^\d+$') {
        throw "Build manifest build ID '$buildId' is invalid."
    }
    if ($buildReason -ne 'Schedule') {
        throw "Build manifest reason '$buildReason' is not a scheduled nightly build."
    }
    if (-not [string]::IsNullOrWhiteSpace($ExpectedBuildId) -and
        $buildId -ne $ExpectedBuildId) {
        throw "Build manifest build ID '$buildId' does not match selected pipeline run '$ExpectedBuildId'."
    }
    if ($version -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]*$') {
        throw "Build manifest version '$version' is not valid for a release tag."
    }
    if ($releaseTag -ne "ghcfa-telem-$version") {
        throw "Build manifest release tag '$releaseTag' does not match version '$version'."
    }
    if ($sourceVersion -notmatch '^[0-9a-fA-F]{40}$') {
        throw "Build manifest source version '$sourceVersion' is not a full Git commit SHA."
    }
    if (-not [string]::IsNullOrWhiteSpace($ExpectedSourceVersion) -and
        $sourceVersion -ne $ExpectedSourceVersion) {
        throw "Build manifest source version '$sourceVersion' does not match selected pipeline commit '$ExpectedSourceVersion'."
    }

    $manifestRuntimeIdentifiers = @($manifest.runtimeIdentifiers | ForEach-Object { [string] $_ })
    if ($manifestRuntimeIdentifiers.Count -ne $runtimeIdentifiers.Count -or
        @(Compare-Object $runtimeIdentifiers $manifestRuntimeIdentifiers).Count -ne 0) {
        throw "Build manifest runtime identifiers do not match the expected six-target matrix."
    }

    $manifestFiles = @($manifest.files)
    if ($manifestFiles.Count -ne ($runtimeIdentifiers.Count * 2)) {
        throw "Build manifest contains $($manifestFiles.Count) files; expected 12 runtime and symbols archives."
    }

    $runtimeArchives = @()
    foreach ($runtimeIdentifier in $runtimeIdentifiers) {
        $expectedFileName = "ghcfa-telem-$version-$runtimeIdentifier.zip"
        $manifestMatches = @($manifestFiles | Where-Object {
            [string] $_.runtimeIdentifier -eq $runtimeIdentifier -and
            [string] $_.file -eq $expectedFileName
        })
        if ($manifestMatches.Count -ne 1) {
            throw "Build manifest must contain exactly one runtime archive entry for '$runtimeIdentifier'."
        }

        $manifestHash = [string] $manifestMatches[0].sha256
        if ($manifestHash -notmatch '^[0-9a-fA-F]{64}$') {
            throw "Build manifest hash for '$expectedFileName' is invalid."
        }

        $artifactDirectory = Join-Path $PipelineWorkspace "telemetry-reporter_$runtimeIdentifier"
        if (-not (Test-Path -LiteralPath $artifactDirectory -PathType Container)) {
            throw "Pipeline artifact directory '$artifactDirectory' was not downloaded."
        }

        $archiveMatches = @(
            Get-ChildItem `
                -LiteralPath $artifactDirectory `
                -File `
                -Recurse `
                -Filter $expectedFileName `
                -ErrorAction Stop
        )
        if ($archiveMatches.Count -ne 1) {
            throw "Expected exactly one '$expectedFileName' in '$artifactDirectory'."
        }

        $archive = $archiveMatches[0]
        $checksumPath = "$($archive.FullName).sha256"
        if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
            throw "Checksum file '$checksumPath' is missing."
        }

        $checksumLine = (Get-Content -LiteralPath $checksumPath -Raw -ErrorAction Stop).Trim()
        $checksumParts = $checksumLine -split '\s+', 2
        if ($checksumParts.Count -ne 2 -or
            $checksumParts[0] -notmatch '^[0-9a-fA-F]{64}$' -or
            $checksumParts[1].Trim() -ne $expectedFileName) {
            throw "Checksum file '$checksumPath' is malformed."
        }

        $actualHash = (
            Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256 -ErrorAction Stop
        ).Hash.ToLowerInvariant()
        if ($actualHash -ne $manifestHash.ToLowerInvariant() -or
            $actualHash -ne $checksumParts[0].ToLowerInvariant()) {
            throw "SHA-256 validation failed for '$expectedFileName'."
        }

        $runtimeArchives += $archive.FullName
    }

    $title = "ghcfa-telem $version"
    if ($DryRun) {
        [ordered]@{
            repository = $Repository
            buildId = $buildId
            buildReason = $buildReason
            tag = $releaseTag
            title = $title
            target = $sourceVersion
            latest = $true
            assets = $runtimeArchives
        } |
            ConvertTo-Json -Depth 4 |
            Write-Output
        exit 0
    }

    $releaseCreated = $false
    try {
        Invoke-GitHubCli -Arguments @(
            'release',
            'create',
            $releaseTag,
            '--repo',
            $Repository,
            '--target',
            $sourceVersion,
            '--title',
            $title,
            '--draft'
        )
        $releaseCreated = $true

        $uploadArguments = @(
            'release',
            'upload',
            $releaseTag,
            '--repo',
            $Repository
        ) + $runtimeArchives
        Invoke-GitHubCli -Arguments $uploadArguments

        Invoke-GitHubCli -Arguments @(
            'release',
            'edit',
            $releaseTag,
            '--repo',
            $Repository,
            '--draft=false',
            '--latest'
        )
        $releaseCreated = $false
    }
    catch {
        $releaseError = $_
        if ($releaseCreated) {
            & gh release delete $releaseTag `
                --repo $Repository `
                --cleanup-tag `
                --yes
            if ($LASTEXITCODE -ne 0) {
                throw "$releaseError`nCleanup of release '$releaseTag' also failed with exit code $LASTEXITCODE."
            }
        }

        throw $releaseError
    }

    Write-Host "Published GitHub release '$releaseTag' with $($runtimeArchives.Count) runtime archives."
}
catch {
    Write-Error $_
    exit 1
}
