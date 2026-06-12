<#
.SYNOPSIS
    Creates or updates a Data Collection Rule via Azure REST API.
.PARAMETER SubscriptionId
    Azure subscription ID.
.PARAMETER ResourceGroupName
    Resource group for the DCR.
.PARAMETER DcrName
    Name of the Data Collection Rule.
.PARAMETER DcrFilePath
    Path to the DCR JSON file.
.PARAMETER ApiVersion
    API version. Defaults to 2025-05-11 (multi-stage support).
.EXAMPLE
    .\put-dcr.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -DcrName "my-dcr" -DcrFilePath "dcr.json"
#>
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ResourceGroupName,
    [Parameter(Mandatory)][string]$DcrName,
    [Parameter(Mandatory)][string]$DcrFilePath,
    [string]$ApiVersion = "2025-05-11"
)

if (-not (Test-Path $DcrFilePath)) {
    Write-Error "DCR file not found: $DcrFilePath"
    exit 1
}

$payload = Get-Content -Path $DcrFilePath -Raw

# Basic JSON validation
try {
    $null = $payload | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Error "Invalid JSON in $DcrFilePath : $_"
    exit 1
}

$path = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.Insights/dataCollectionRules/$DcrName`?api-version=$ApiVersion"
$response = Invoke-AzRestMethod -Path $path -Method PUT -Payload $payload

if ($response.StatusCode -in 200, 201) {
    Write-Host "DCR '$DcrName' deployed successfully. Status: $($response.StatusCode)"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} else {
    Write-Error "Failed to deploy DCR. Status: $($response.StatusCode). Content: $($response.Content)"
    exit 1
}
