<#
.SYNOPSIS
    Retrieves an existing Data Collection Rule via Azure REST API.
.PARAMETER SubscriptionId
    Azure subscription ID.
.PARAMETER ResourceGroupName
    Resource group containing the DCR.
.PARAMETER DcrName
    Name of the Data Collection Rule.
.PARAMETER OutputPath
    Optional. File path to save the DCR JSON. If omitted, outputs to console.
.PARAMETER ApiVersion
    API version. Defaults to 2025-05-11 (multi-stage support).
.EXAMPLE
    .\get-dcr.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -DcrName "my-dcr"
    .\get-dcr.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -DcrName "my-dcr" -OutputPath "dcr.json"
#>
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ResourceGroupName,
    [Parameter(Mandatory)][string]$DcrName,
    [string]$OutputPath,
    [string]$ApiVersion = "2025-05-11"
)

$path = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.Insights/dataCollectionRules/$DcrName`?api-version=$ApiVersion"
$response = Invoke-AzRestMethod -Path $path -Method GET

if ($response.StatusCode -ne 200) {
    Write-Error "Failed to get DCR. Status: $($response.StatusCode). Content: $($response.Content)"
    exit 1
}

$json = $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 20

if ($OutputPath) {
    $json | Set-Content -Path $OutputPath -Encoding utf8
    Write-Host "DCR saved to $OutputPath"
} else {
    Write-Output $json
}
