<#
.SYNOPSIS
    Validates Azure quota capacity for a planned deployment.
.DESCRIPTION
    For each resource you intend to deploy, queries the quota limit and current
    usage (via the `az quota` CLI), then computes available capacity, the total
    after deployment (current usage + planned count), and a per-resource status.
    Prints a markdown checklist table plus an overall verdict so the result can
    be pasted directly into the deployment plan's Provisioning Limit Checklist.

    Scope: quota-API-SUPPORTED providers only (e.g. Microsoft.Compute,
    Microsoft.Network, Microsoft.App, Microsoft.Storage). For providers the quota
    API rejects with BadRequest (e.g. Microsoft.DocumentDB / Cosmos DB), the row
    is flagged as unsupported — follow the manual Resource Graph + service-docs
    fallback described in the skill.
.PARAMETER Region
    Azure region to validate (e.g. "eastus", "westus2").
.PARAMETER Resources
    One or more "provider:quota-name:count" triples describing what to deploy.
    count = number of units to ADD, expressed in the quota's own unit (vCPUs for
    VM-family quotas, e.g. 3 x Standard_D4s_v3 = 12; instance count for count-based
    quotas like StorageAccounts or ManagedEnvironmentCount).
.PARAMETER SubscriptionId
    Azure subscription ID. Defaults to the current subscription.
.EXAMPLE
    .\check-quota.ps1 -Region eastus -Resources "Microsoft.Compute:standardDSv3Family:12"
.EXAMPLE
    .\check-quota.ps1 -Region eastus -Resources `
        "Microsoft.App:ManagedEnvironmentCount:1", `
        "Microsoft.Compute:standardDSv3Family:12", `
        "Microsoft.Storage:StorageAccounts:2"
#>
param(
    [string]$Region,
    [string[]]$Resources,
    [string]$SubscriptionId
)

$ErrorActionPreference = "Stop"

# Validate required parameters explicitly (instead of [Parameter(Mandatory)], which
# would prompt interactively when a value is omitted).
if (-not $Region -or -not $Resources -or $Resources.Count -eq 0) {
    Write-Error "Region and Resources must be provided. Usage: .\check-quota.ps1 -Region <region> -Resources '<provider:quota-name:count>'[,...] [-SubscriptionId <id>]"
    exit 1
}

# Ensure the quota extension is installed
$ext = az extension list --query "[?name=='quota'].name" -o tsv 2>$null
if (-not $ext) {
    Write-Host "Installing quota extension..."
    az extension add --name quota --yes 2>$null
}

# Resolve subscription
if (-not $SubscriptionId) {
    $SubscriptionId = az account show --query id -o tsv
}

Write-Host "Validating quota capacity in region '$Region' (subscription $SubscriptionId)"
Write-Host ""

$lines = @()
$lines += "| Provider | Quota | Region | Limit | Usage | Need | Total After | Available | Status |"
$lines += "|----------|-------|--------|-------|-------|------|-------------|-----------|--------|"

$overall = "ok"   # ok | near | insufficient

foreach ($triple in $Resources) {
    $parts = $triple.Split(":")
    if ($parts.Count -ne 3 -or -not $parts[0] -or -not $parts[1] -or -not $parts[2]) {
        throw "Invalid resource '$triple' — expected provider:quota-name:count"
    }
    $provider = $parts[0]
    $quotaName = $parts[1]
    $count = [int]$parts[2]

    $scope = "/subscriptions/$SubscriptionId/providers/$provider/locations/$Region"

    # Query limit. If the provider is not supported by the quota API, the call
    # fails — flag the row and continue (supported-only scope).
    $limit = az quota show --resource-name $quotaName --scope $scope --query "properties.limit.value" -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $limit) {
        $lines += "| $provider | $quotaName | $Region | — | — | $count | — | — | ⚠️ Unsupported — see docs |"
        if ($overall -eq "ok") { $overall = "near" }
        continue
    }
    $limit = [int]$limit

    $usageVal = az quota usage show --resource-name $quotaName --scope $scope --query "properties.usages.value" -o tsv 2>$null
    if (-not $usageVal) { $usageVal = 0 }
    $usageVal = [int]$usageVal

    $available = $limit - $usageVal
    $totalAfter = $usageVal + $count

    if ($totalAfter -gt $limit) {
        $status = "❌ Insufficient"
        $overall = "insufficient"
    } elseif (($totalAfter * 100) -gt ($limit * 80)) {
        $status = "⚠️ Near limit"
        if ($overall -eq "ok") { $overall = "near" }
    } else {
        $status = "✅ Within limit"
    }

    $lines += "| $provider | $quotaName | $Region | $limit | $usageVal | $count | $totalAfter | $available | $status |"
}

$lines | ForEach-Object { Write-Output $_ }

Write-Output ""
switch ($overall) {
    "insufficient" { Write-Output "Overall: ❌ Insufficient capacity — request a quota increase or choose a different region." }
    "near"         { Write-Output "Overall: ⚠️ Near limit or unsupported rows present — review flagged resources before proceeding." }
    default        { Write-Output "Overall: ✅ All resources within limits." }
}
