# collect-artifacts.ps1 — download comparison test trajectories from Azure Storage.
#
# Usage: ./collect-artifacts.ps1 -InputFile <input.json>
#
# Exit codes:
#   0 = success (all runs collected)
#   1 = a step failed (missing dependency, Azure error, or no blobs found)
#   2 = usage/argument error

[CmdletBinding()]
param(
    [string]$InputFile
)

$StorageAccount = "strdashboarddevveobvk"
$Container = "manual-integration-reports"
$OutputRoot = "comparison-artifacts"

# Mirrors sanitizeTestName() used by the test harness when writing blob paths.
function Get-SanitizedTestName {
    param([string]$Name)

    $sanitized = $Name -replace '[<>:"/\\|?*]', "-" -replace "\s+", "_" -replace "-+", "-" -replace "_+", "_"
    if ($sanitized.Length -gt 200) { $sanitized = $sanitized.Substring(0, 200) }
    return $sanitized
}

if ([string]::IsNullOrWhiteSpace($InputFile)) {
    Write-Error "Error: expected the -InputFile parameter (path to the input JSON file)."
    exit 2
}

if (-not (Test-Path -LiteralPath $InputFile -PathType Leaf)) {
    Write-Error "Error: input file not found: $InputFile"
    exit 2
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Error: required command 'az' is not installed."
    exit 1
}

try {
    $config = Get-Content -LiteralPath $InputFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
}
catch {
    Write-Error "Error: failed to parse input JSON: $_"
    exit 2
}

$date = $config.date
$skillName = $config.skill.name
$stimuliName = $config.stimuliName

if ([string]::IsNullOrWhiteSpace($date) -or [string]::IsNullOrWhiteSpace($skillName) -or [string]::IsNullOrWhiteSpace($stimuliName)) {
    Write-Error "Error: input JSON must define 'date', 'skill.name', and 'stimuliName'."
    exit 2
}

$sanitizedStimuliName = Get-SanitizedTestName -Name $stimuliName

if (-not $config.runs -or $config.runs.Count -eq 0) {
    Write-Error "Error: input JSON contains no runs."
    exit 2
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$failed = $false

foreach ($run in $config.runs) {
    $runId = ($run.run -split "/")[-1]
    if ([string]::IsNullOrWhiteSpace($runId)) {
        Write-Error "Error: could not extract run id from URL: $($run.run)"
        $failed = $true
        continue
    }

    $suffix = if ($run.withSkill) { "with-skill" } else { "without-skill" }
    $destDir = Join-Path $OutputRoot "$($run.model)-$suffix"

    $prefix = "$date/$runId/$skillName/${skillName}_$sanitizedStimuliName/agent-metadata-"

    Write-Host "Listing blobs under $Container/$prefix ..."
    $blobs = az storage blob list `
        --account-name $StorageAccount `
        --container-name $Container `
        --prefix $prefix `
        --auth-mode login `
        --query "[?ends_with(name, '.md')].name" `
        -o tsv
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error: failed to list blobs for run $runId."
        $failed = $true
        continue
    }

    $blobNames = @($blobs | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($blobNames.Count -eq 0) {
        Write-Error "Error: no trajectory blobs found under $prefix"
        $failed = $true
        continue
    }

    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    foreach ($blob in $blobNames) {
        $fileName = ($blob -split "/")[-1]
        Write-Host "  downloading $fileName -> $destDir"
        az storage blob download `
            --account-name $StorageAccount `
            --container-name $Container `
            --name $blob `
            --file (Join-Path $destDir $fileName) `
            --auth-mode login `
            --overwrite `
            --no-progress `
            -o none
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error: failed to download blob $blob"
            $failed = $true
        }
    }
}

if ($failed) {
    Write-Error "Completed with errors. Partial artifacts are in $OutputRoot"
    exit 1
}

Write-Host "Artifacts collected in $OutputRoot"
exit 0
