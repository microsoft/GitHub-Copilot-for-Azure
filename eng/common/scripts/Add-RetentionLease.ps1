#!/usr/bin/env pwsh
#Requires -Version 7
# Replaces this pipeline run's Azure SDK automation retention lease with a new long-lived lease.
# Exit codes: 0 = success, 1 = Azure DevOps API failure, 2 = invalid arguments.

[CmdletBinding()]
param(
    [string] $Organization = 'azure-sdk',
    [string] $Project,
    [int] $DefinitionId,
    [int] $RunId,
    [int] $DaysValid = 731,
    [string] $OwnerId = 'azure-sdk-pipeline-automation',
    [string] $AccessToken = $env:SYSTEMACCESSTOKEN
)

Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Organization) -or
    [string]::IsNullOrWhiteSpace($Project) -or
    $DefinitionId -le 0 -or
    $RunId -le 0 -or
    $DaysValid -le 0 -or
    [string]::IsNullOrWhiteSpace($OwnerId) -or
    [string]::IsNullOrWhiteSpace($AccessToken)) {
    Write-Error 'Organization, Project, DefinitionId, RunId, DaysValid, OwnerId, and AccessToken are required.'
    exit 2
}

$encodedToken = [Convert]::ToBase64String(
    [Text.Encoding]::UTF8.GetBytes("nobody:$AccessToken")
)
Write-Host "##vso[task.setvariable variable=_retentionAccessToken;issecret=true]$encodedToken"
$headers = @{
    Authorization = "Basic $encodedToken"
}
$escapedProject = [Uri]::EscapeDataString($Project)
$baseUri = "https://dev.azure.com/$Organization/$escapedProject/_apis/build/retention/leases"

try {
    $existingUri = "$baseUri?ownerId=$([Uri]::EscapeDataString($OwnerId))" +
        "&definitionId=$DefinitionId&runId=$RunId&api-version=6.0-preview.1"
    $existingLeases = Invoke-RestMethod `
        -Method Get `
        -Uri $existingUri `
        -Headers $headers `
        -MaximumRetryCount 3 `
        -ErrorAction Stop

    foreach ($lease in @($existingLeases.value)) {
        if ($null -eq $lease.leaseId) {
            throw 'Azure DevOps returned a retention lease without a lease ID.'
        }

        $deleteUri = "$baseUri?ids=$($lease.leaseId)&api-version=6.0-preview.1"
        $null = Invoke-RestMethod `
            -Method Delete `
            -Uri $deleteUri `
            -Headers $headers `
            -MaximumRetryCount 3 `
            -ErrorAction Stop
    }

    $requestBody = @(
        [ordered]@{
            definitionId = $DefinitionId
            runId = $RunId
            ownerId = $OwnerId
            daysValid = $DaysValid
        }
    ) | ConvertTo-Json -Depth 3
    $createdLease = Invoke-RestMethod `
        -Method Post `
        -Uri "$baseUri?api-version=6.0-preview.1" `
        -Headers $headers `
        -Body $requestBody `
        -ContentType 'application/json' `
        -MaximumRetryCount 3 `
        -ErrorAction Stop

    $leaseId = @($createdLease.value)[0].leaseId
    if ($null -eq $leaseId) {
        throw 'Azure DevOps did not return an ID for the new retention lease.'
    }

    Write-Host "Retained pipeline run '$RunId' for $DaysValid days with lease '$leaseId'."
}
catch {
    Write-Error $_
    exit 1
}
