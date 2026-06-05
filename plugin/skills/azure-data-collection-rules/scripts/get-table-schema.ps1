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
.EXAMPLE
    .\get-table-schema.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -WorkspaceName "my-ws" -TableName "Syslog"
#>
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ResourceGroupName,
    [Parameter(Mandatory)][string]$WorkspaceName,
    [Parameter(Mandatory)][string]$TableName,
    [string]$ApiVersion = "2022-10-01"
)

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
