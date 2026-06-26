<#
.SYNOPSIS
    Retrieves the schema of a Log Analytics table.
.PARAMETER SubscriptionId
    Azure subscription ID.
.PARAMETER ResourceGroupName
    Resource group containing the workspace.
.PARAMETER WorkspaceName
    Log Analytics workspace name.
.PARAMETER TableName
    Table name (e.g., "Syslog", "MyCustom_CL").
.NOTES
    Requires Az.Accounts module (Invoke-AzRestMethod). Run Connect-AzAccount before use.
.EXAMPLE
    .\get-table-schema.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -WorkspaceName "my-ws" -TableName "Syslog"
#>
param(
    [string]$SubscriptionId,
    [string]$ResourceGroupName,
    [string]$WorkspaceName,
    [string]$TableName,
    [string]$ApiVersion = "2022-10-01"
)

# Parameter validation (explicit checks to avoid interactive prompts in agent runtime)
if (-not $SubscriptionId) { Write-Error "SubscriptionId is required."; exit 1 }
if (-not $ResourceGroupName) { Write-Error "ResourceGroupName is required."; exit 1 }
if (-not $WorkspaceName) { Write-Error "WorkspaceName is required."; exit 1 }
if (-not $TableName) { Write-Error "TableName is required."; exit 1 }

$path = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.OperationalInsights/workspaces/$WorkspaceName/tables/$TableName`?api-version=$ApiVersion"
$response = Invoke-AzRestMethod -Path $path -Method GET

if ($response.StatusCode -ne 200) {
    Write-Error "Failed to get table schema. Status: $($response.StatusCode). Content: $($response.Content)"
    exit 1
}

$table = $response.Content | ConvertFrom-Json
$columns = $table.properties.schema.columns

Write-Host "Table: $($table.properties.schema.name)"
Write-Host "Plan: $($table.properties.plan)"
Write-Host "Retention: $($table.properties.retentionInDays) days"
Write-Host ""
Write-Host "Columns:"
$columns | Format-Table name, type -AutoSize
