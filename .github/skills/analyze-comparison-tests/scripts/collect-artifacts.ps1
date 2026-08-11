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

if ([string]::IsNullOrWhiteSpace($date) -or [string]::IsNullOrWhiteSpace($skillName)) {
    Write-Error "Error: input JSON must define 'date' and 'skill.name'."
    exit 2
}

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

    # Discover stimuli for this run by listing blobs under {date}/{runId}/{skill-name}_ prefix.
    Write-Host "Discovering stimuli for run $runId under $Container/$date/$runId/$skillName/${skillName}_ ..."
    $discoveryResult = az storage blob list `
        --account-name $StorageAccount `
        --container-name $Container `
        --prefix "$date/$runId/$skillName/${skillName}_" `
        --auth-mode login `
        --query "[?ends_with(name, '.md')].name" `
        -o tsv
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error: failed to discover blobs for run $runId."
        $failed = $true
        continue
    }

    # Extract unique stimuli names from blob paths.
    # Blob path: {date}/{runId}/{skill}/{skill}_{stimuli}/agent-metadata-*.md
    $discoveredStimuli = @{}
    foreach ($blob in @($discoveryResult | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
        if ($blob -match "/$skillName/([^/]+)/") {
            $stimuliPart = $blob -replace ".*/$skillName/([^/]+)/.*", '$1'
            $discoveredStimuli[$stimuliPart] = $true
        }
    }

    if ($discoveredStimuli.Count -eq 0) {
        Write-Host "Warning: no stimuli directories discovered for run $runId"
        continue
    }

    Write-Host "Discovered stimuli for run $runId`: $($discoveredStimuli.Keys -join ', ')"

    foreach ($stimuliPart in $discoveredStimuli.Keys) {
        $stimuliOutputDir = Join-Path $OutputRoot "$stimuliPart" "$($run.model)-$suffix"

        $prefix = "$date/$runId/$skillName/${skillName}_$stimuliPart/agent-metadata-"

        Write-Host "Listing blobs for stimuli '$stimuliPart' in run $runId ..."
        $blobs = az storage blob list `
            --account-name $StorageAccount `
            --container-name $Container `
            --prefix $prefix `
            --auth-mode login `
            --query "[?ends_with(name, '.md')].name" `
            -o tsv
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error: failed to list blobs for run $runId, stimuli $stimuliPart."
            $failed = $true
            continue
        }

        $blobNames = @($blobs | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($blobNames.Count -eq 0) {
            Write-Host "Warning: no trajectory blobs found for run $runId, stimuli $stimuliPart."
            continue
        }

        New-Item -ItemType Directory -Force -Path $stimuliOutputDir | Out-Null

        foreach ($blob in $blobNames) {
            $fileName = ($blob -split "/")[-1]
            Write-Host "  downloading $fileName -> $stimuliOutputDir"
            az storage blob download `
                --account-name $StorageAccount `
                --container-name $Container `
                --name $blob `
                --file (Join-Path $stimuliOutputDir $fileName) `
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
}

if ($failed) {
    Write-Error "Completed with errors. Partial artifacts are in $OutputRoot"
    exit 1
}

Write-Host "Artifacts collected in $OutputRoot"
exit 0
