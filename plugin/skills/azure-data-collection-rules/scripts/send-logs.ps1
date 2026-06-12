<#
.SYNOPSIS
    Sends sample data to Azure Monitor via the Log Ingestion API.
.DESCRIPTION
    Authenticates using an Entra app registration (client credentials flow)
    and POSTs a JSON array to the DCR logs ingestion endpoint.
.PARAMETER TenantId
    Entra tenant ID.
.PARAMETER AppId
    Application (client) ID of the registered app.
.PARAMETER AppSecret
    Client secret value.
.PARAMETER EndpointUri
    DCR logs ingestion endpoint URI (e.g., https://my-dcr-xyz.eastus-1.ingest.monitor.azure.com).
.PARAMETER DcrImmutableId
    The immutableId of the DCR (e.g., dcr-00000000000000000000000000000000).
.PARAMETER StreamName
    Stream name in the DCR (e.g., Custom-MyAppLogs).
.PARAMETER DataFilePath
    Path to a JSON file containing an array of log records.
.EXAMPLE
    .\send-logs.ps1 -TenantId "xxx" -AppId "yyy" -AppSecret "zzz" `
        -EndpointUri "https://my-dcr.eastus-1.ingest.monitor.azure.com" `
        -DcrImmutableId "dcr-abc123" -StreamName "Custom-MyAppLogs" `
        -DataFilePath "sample-data.json"
#>
param(
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$AppId,
    [Parameter(Mandatory)][string]$AppSecret,
    [Parameter(Mandatory)][string]$EndpointUri,
    [Parameter(Mandatory)][string]$DcrImmutableId,
    [Parameter(Mandatory)][string]$StreamName,
    [Parameter(Mandatory)][string]$DataFilePath
)

if (-not (Test-Path $DataFilePath)) {
    Write-Error "Data file not found: $DataFilePath"
    exit 1
}

$data = Get-Content -Path $DataFilePath -Raw

# Validate JSON array
try {
    $parsed = $data | ConvertFrom-Json -ErrorAction Stop
    if ($parsed -isnot [System.Array]) {
        Write-Error "Data must be a JSON array (wrap in [ ])"
        exit 1
    }
} catch {
    Write-Error "Invalid JSON: $_"
    exit 1
}

# Step 1: Get bearer token
$tokenBody = @{
    client_id     = $AppId
    scope         = "https://monitor.azure.com/.default"
    client_secret = $AppSecret
    grant_type    = "client_credentials"
}
$tokenUri = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"

try {
    $tokenResponse = Invoke-RestMethod -Uri $tokenUri -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    $bearerToken = $tokenResponse.access_token
} catch {
    Write-Error "Failed to acquire token: $_"
    exit 1
}

# Step 2: Send data
$sendHeaders = @{
    "Authorization" = "Bearer $bearerToken"
    "Content-Type" = "application/json"
}
$sendUri = "$EndpointUri/dataCollectionRules/$DcrImmutableId/streams/$($StreamName)?api-version=2023-01-01"

try {
    $response = Invoke-RestMethod -Uri $sendUri -Method Post -Body $data -Headers $sendHeaders
    Write-Host "Data sent successfully. Records: $($parsed.Count)"
} catch {
    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 'N/A' }
    Write-Error "Failed to send data. Status: $statusCode. Error: $_"
    exit 1
}
