<#
.SYNOPSIS
    Sends sample data to Azure Monitor via the Log Ingestion API.
.DESCRIPTION
    Authenticates using Azure CLI (az account get-access-token) and POSTs
    a JSON array to the DCR logs ingestion endpoint.
    Requires: Azure CLI logged in with appropriate permissions.
.PARAMETER EndpointUri
    DCR logs ingestion endpoint URI (e.g., https://my-dcr-xyz.eastus-1.ingest.monitor.azure.com).
.PARAMETER DcrImmutableId
    The immutableId of the DCR (e.g., dcr-00000000000000000000000000000000).
.PARAMETER StreamName
    Stream name in the DCR (e.g., Custom-MyAppLogs).
.PARAMETER DataFilePath
    Path to a JSON file containing an array of log records.
.NOTES
    Authentication uses the current Azure CLI session. Run 'az login' before use.
    The caller must have the 'Monitoring Metrics Publisher' role on the DCR.
.EXAMPLE
    .\send-logs.ps1 -EndpointUri "https://my-dcr.eastus-1.ingest.monitor.azure.com" `
        -DcrImmutableId "dcr-abc123" -StreamName "Custom-MyAppLogs" `
        -DataFilePath "sample-data.json"
#>
param(
    [string]$EndpointUri,
    [string]$DcrImmutableId,
    [string]$StreamName,
    [string]$DataFilePath
)

# Parameter validation (explicit checks instead of [Parameter(Mandatory)] to avoid interactive prompts)
if (-not $EndpointUri) { Write-Error "EndpointUri is required."; exit 1 }
if (-not $DcrImmutableId) { Write-Error "DcrImmutableId is required."; exit 1 }
if (-not $StreamName) { Write-Error "StreamName is required."; exit 1 }
if (-not $DataFilePath) { Write-Error "DataFilePath is required."; exit 1 }

if (-not (Test-Path $DataFilePath)) {
    Write-Error "Data file not found: $DataFilePath"
    exit 1
}

$data = Get-Content -Path $DataFilePath -Raw

# Validate JSON array (wrap in @() to handle PS 5.1 single-element unrolling)
try {
    $parsed = $data | ConvertFrom-Json -ErrorAction Stop
    $parsed = @($parsed)
    if ($parsed.Count -eq 0) {
        Write-Error "Data file contains no records"
        exit 1
    }
} catch {
    Write-Error "Invalid JSON: $_"
    exit 1
}

# Step 1: Get bearer token via Azure CLI
try {
    $tokenJson = az account get-access-token --resource "https://monitor.azure.com" --output json 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to get token via Azure CLI. Run 'az login' first. Error: $tokenJson"
        exit 1
    }
    $tokenObj = $tokenJson | ConvertFrom-Json
    $bearerToken = $tokenObj.accessToken
} catch {
    Write-Error "Failed to acquire token via Azure CLI: $_"
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
