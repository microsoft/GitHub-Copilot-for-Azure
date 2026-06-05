<#
.SYNOPSIS
    Creates or updates a custom Log Analytics table.
.PARAMETER SubscriptionId
    Azure subscription ID.
.PARAMETER ResourceGroupName
    Resource group containing the workspace.
.PARAMETER WorkspaceName
    Log Analytics workspace name.
.PARAMETER TableName
    Table name (must end with _CL).
.PARAMETER SchemaFilePath
    Path to a JSON file defining the table schema.
.PARAMETER RetentionInDays
    Data retention in days. Default: 30.
.PARAMETER TotalRetentionInDays
    Total retention including archive. Default: 90.
.PARAMETER Plan
    Table plan: Analytics, Basic, or Auxiliary. Default: Analytics.
.EXAMPLE
    .\create-custom-table.ps1 -SubscriptionId "xxx" -ResourceGroupName "my-rg" -WorkspaceName "my-ws" -TableName "MyLogs_CL" -SchemaFilePath "table-schema.json"

    Schema file format:
    {
        "columns": [
            { "name": "TimeGenerated", "type": "datetime" },
            { "name": "Computer", "type": "string" },
            { "name": "Message", "type": "string" }
        ]
    }
#>
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ResourceGroupName,
    [Parameter(Mandatory)][string]$WorkspaceName,
    [Parameter(Mandatory)][string]$TableName,
    [Parameter(Mandatory)][string]$SchemaFilePath,
    [int]$RetentionInDays = 30,
    [int]$TotalRetentionInDays = 90,
    [ValidateSet("Analytics", "Basic", "Auxiliary")][string]$Plan = "Analytics",
    [string]$ApiVersion = "2022-10-01"
)

if (-not $TableName.EndsWith("_CL")) {
    Write-Error "Custom table name must end with '_CL'"
    exit 1
}

if (-not (Test-Path $SchemaFilePath)) {
    Write-Error "Schema file not found: $SchemaFilePath"
    exit 1
}

$schema = Get-Content -Path $SchemaFilePath -Raw | ConvertFrom-Json

# Verify TimeGenerated exists
$hasTimeGenerated = $schema.columns | Where-Object { $_.name -eq "TimeGenerated" -and $_.type -eq "datetime" }
if (-not $hasTimeGenerated) {
    Write-Error "Schema must include a 'TimeGenerated' column of type 'datetime'"
    exit 1
}

$body = @{
    properties = @{
        schema = @{
            name = $TableName
            columns = $schema.columns
        }
        retentionInDays = $RetentionInDays
        totalRetentionInDays = $TotalRetentionInDays
        plan = $Plan
    }
} | ConvertTo-Json -Depth 10

$path = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.OperationalInsights/workspaces/$WorkspaceName/tables/$TableName`?api-version=$ApiVersion"
$response = Invoke-AzRestMethod -Path $path -Method PUT -Payload $body

if ($response.StatusCode -in 200, 202) {
    Write-Host "Table '$TableName' created/updated successfully."
} else {
    Write-Error "Failed. Status: $($response.StatusCode). Content: $($response.Content)"
    exit 1
}
