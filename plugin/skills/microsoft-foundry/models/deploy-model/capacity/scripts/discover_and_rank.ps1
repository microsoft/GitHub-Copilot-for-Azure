<#
.SYNOPSIS
    Discovers available capacity for an Azure OpenAI model across all regions,
    cross-references with existing projects, and outputs a ranked table.
.PARAMETER ModelName
    The model name (e.g., "gpt-4o", "o3-mini")
.PARAMETER ModelVersion
    The model version (e.g., "2025-01-31")
.PARAMETER MinCapacity
    Minimum required capacity in K TPM units (default: 0, shows all)
.EXAMPLE
    .\discover_and_rank.ps1 -ModelName o3-mini -ModelVersion 2025-01-31 -MinCapacity 200
#>
param(
    [Parameter(Mandatory)][string]$ModelName,
    [Parameter(Mandatory)][string]$ModelVersion,
    [int]$MinCapacity = 0
)

$ErrorActionPreference = "Stop"

$subId = az account show --query id -o tsv

# Query model capacity across all regions
$capRaw = az rest --method GET `
    --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/modelCapacities" `
    --url-parameters api-version=2024-10-01 modelFormat=OpenAI modelName=$ModelName modelVersion=$ModelVersion `
    2>$null | Out-String | ConvertFrom-Json

# Query all AI Foundry projects (AIProject kind)
$projRaw = az rest --method GET `
    --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/accounts" `
    --url-parameters api-version=2024-10-01 `
    --query "value[?kind=='AIProject'].{Name:name, Location:location}" `
    2>$null | Out-String | ConvertFrom-Json

# Build capacity map (GlobalStandard only, pick max per region)
$capMap = @{}
foreach ($item in $capRaw.value) {
    $sku = $item.properties.skuName
    $avail = [int]$item.properties.availableCapacity
    $region = $item.location
    if ($sku -eq "GlobalStandard" -and $avail -gt 0) {
        if (-not $capMap[$region] -or $avail -gt $capMap[$region]) {
            $capMap[$region] = $avail
        }
    }
}

# Build project map
$projMap = @{}
$projSample = @{}
foreach ($p in $projRaw) {
    $loc = $p.Location
    if (-not $projMap[$loc]) { $projMap[$loc] = 0 }
    $projMap[$loc]++
    if (-not $projSample[$loc]) { $projSample[$loc] = $p.Name }
}

# Combine and rank
$results = foreach ($region in $capMap.Keys) {
    $avail = $capMap[$region]
    $meets = $avail -ge $MinCapacity
    [PSCustomObject]@{
        Region        = $region
        AvailableTPM  = "${avail}K"
        AvailableRaw  = $avail
        MeetsTarget   = if ($meets) { "YES" } else { "no" }
        Projects      = if ($projMap[$region]) { $projMap[$region] } else { 0 }
        SampleProject = if ($projSample[$region]) { $projSample[$region] } else { "(none)" }
    }
}

$results = $results | Sort-Object @{Expression={$_.MeetsTarget -eq "YES"}; Descending=$true},
                                   @{Expression={$_.Projects}; Descending=$true},
                                   @{Expression={$_.AvailableRaw}; Descending=$true}

# Output summary
$total = ($results | Measure-Object).Count
$matching = ($results | Where-Object { $_.MeetsTarget -eq "YES" } | Measure-Object).Count
$withProjects = ($results | Where-Object { $_.MeetsTarget -eq "YES" -and $_.Projects -gt 0 } | Measure-Object).Count

Write-Host "Model: $ModelName v$ModelVersion | SKU: GlobalStandard | Min Capacity: ${MinCapacity}K TPM"
Write-Host "Regions with capacity: $total | Meets target: $matching | With projects: $withProjects"
Write-Host ""

$results | Select-Object Region, AvailableTPM, MeetsTarget, Projects, SampleProject | Format-Table -AutoSize
