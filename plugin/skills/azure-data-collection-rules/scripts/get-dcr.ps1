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
    File path to save the full DCR JSON. Defaults to './{DcrName}.json'.
.PARAMETER ApiVersion
    API version. Defaults to 2025-05-11 (multi-stage support).
.NOTES
    Requires Az.Accounts module (Invoke-AzRestMethod). Run Connect-AzAccount before use.
    Full DCR JSON is always written to a file to avoid context overflow.
    A summary (kind, streams, dataFlows, destinations) is printed to stdout.
.EXAMPLE
    .\get-dcr.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -DcrName "my-dcr"
    .\get-dcr.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -DcrName "my-dcr" -OutputPath "dcr.json"
#>
param(
    [string]$SubscriptionId,
    [string]$ResourceGroupName,
    [string]$DcrName,
    [string]$OutputPath,
    [string]$ApiVersion = "2025-05-11"
)

# Parameter validation (explicit checks to avoid interactive prompts in agent runtime)
if (-not $SubscriptionId) { Write-Error "SubscriptionId is required."; exit 1 }
if (-not $ResourceGroupName) { Write-Error "ResourceGroupName is required."; exit 1 }
if (-not $DcrName) { Write-Error "DcrName is required."; exit 1 }

if (-not $OutputPath) { $OutputPath = "./$DcrName.json" }

$path = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.Insights/dataCollectionRules/$DcrName`?api-version=$ApiVersion"
$response = Invoke-AzRestMethod -Path $path -Method GET

if ($response.StatusCode -ne 200) {
    Write-Error "Failed to get DCR. Status: $($response.StatusCode). Content: $($response.Content)"
    exit 1
}

$dcrObj = $response.Content | ConvertFrom-Json
$json = $dcrObj | ConvertTo-Json -Depth 20

# Write full JSON to file (avoids blowing up token context)
$json | Set-Content -Path $OutputPath -Encoding utf8

# Print summary to stdout
$props = $dcrObj.properties
Write-Host "DCR saved to: $OutputPath"
Write-Host "Kind: $($dcrObj.kind)"
Write-Host "Provisioning: $($props.provisioningState)"
$streamNames = if ($props.streamDeclarations) { $props.streamDeclarations.PSObject.Properties.Name -join ', ' } else { '(none)' }
Write-Host "Streams: $streamNames"
$flowCount = if ($props.dataFlows) { @($props.dataFlows).Count } else { 0 }
Write-Host "DataFlows: $flowCount"
$destNames = @()
if ($props.destinations) {
    foreach ($destType in $props.destinations.PSObject.Properties) {
        foreach ($dest in $destType.Value) { if ($dest.name) { $destNames += $dest.name } }
    }
}
Write-Host "Destinations: $($destNames -join ', ')"
