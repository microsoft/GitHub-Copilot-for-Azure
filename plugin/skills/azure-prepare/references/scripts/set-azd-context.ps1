<#
.SYNOPSIS
    Detects, applies, and verifies azd subscription/location context.
.DESCRIPTION
    Emits machine-readable key=value lines followed by a human-readable summary.
.PARAMETER SubscriptionId
    User-confirmed Azure subscription ID to set in the azd environment.
.PARAMETER Location
    User-confirmed Azure location to set in the azd environment.
.PARAMETER EnvironmentName
    Optional azd environment name to select before detecting or setting values.
.PARAMETER DetectOnly
    Detect current azd/default/Azure CLI context without changing azd values.
.EXAMPLE
    .\set-azd-context.ps1 -SubscriptionId <subscription-id> -Location <location> -EnvironmentName <environment-name>
.EXAMPLE
    .\set-azd-context.ps1 -DetectOnly -EnvironmentName <environment-name>
#>
param(
    [string]$SubscriptionId,
    [string]$Location,
    [string]$EnvironmentName,
    [switch]$DetectOnly
)

$ErrorActionPreference = 'Stop'

if (-not $DetectOnly -and (-not $SubscriptionId -or -not $Location)) {
    throw 'Usage: .\set-azd-context.ps1 -SubscriptionId <subscription-id> -Location <location> [-EnvironmentName <environment-name>] or .\set-azd-context.ps1 -DetectOnly [-EnvironmentName <environment-name>]'
}

function Convert-AzdValue {
    param([string]$Value)
    if ($null -eq $Value) { return '' }
    return $Value.Trim().Trim('"').Trim("'")
}

function Get-AzdContextValues {
    $result = @{
        SubscriptionId = ''
        Location = ''
    }

    $values = azd env get-values 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $result
    }

    foreach ($line in $values) {
        if (-not $line -or -not $line.Contains('=')) { continue }
        $name, $value = $line.Split('=', 2)
        $cleanValue = Convert-AzdValue $value
        switch ($name) {
            'AZURE_SUBSCRIPTION_ID' { $result.SubscriptionId = $cleanValue }
            'AZURE_LOCATION' { $result.Location = $cleanValue }
        }
    }

    return $result
}

$azdEnvironment = $EnvironmentName
if ($azdEnvironment) {
    azd env select $azdEnvironment | Out-Null
}

$azdEnvList = azd env list 2>$null
if (-not $azdEnvironment -and $LASTEXITCODE -eq 0) {
    $selected = $azdEnvList | Where-Object { $_ -match '^\*\s+' } | Select-Object -First 1
    if ($selected -and $selected -match '^\*\s+(\S+)') {
        $azdEnvironment = $Matches[1]
    }
}

$existing = Get-AzdContextValues
$existingSubscriptionId = $existing.SubscriptionId
$existingLocation = $existing.Location

$defaultSubscriptionId = ''
$defaultLocation = ''
$defaultsJson = azd config get defaults 2>$null
if ($LASTEXITCODE -eq 0 -and $defaultsJson) {
    $defaults = ($defaultsJson | Out-String | ConvertFrom-Json)
    $defaultSubscriptionId = $defaults.subscription
    $defaultLocation = $defaults.location
}

$azSubscriptionName = ''
$azSubscriptionId = ''
$accountJson = az account show --query "{name:name, id:id}" -o json 2>$null
if ($LASTEXITCODE -eq 0 -and $accountJson) {
    $account = ($accountJson | Out-String | ConvertFrom-Json)
    $azSubscriptionName = $account.name
    $azSubscriptionId = $account.id
}

$verifiedSubscriptionId = ''
$verifiedLocation = ''
if (-not $DetectOnly) {
    azd env set AZURE_SUBSCRIPTION_ID $SubscriptionId | Out-Null
    azd env set AZURE_LOCATION $Location | Out-Null

    $verified = Get-AzdContextValues
    $verifiedSubscriptionId = $verified.SubscriptionId
    $verifiedLocation = $verified.Location

    if ($verifiedSubscriptionId -ne $SubscriptionId -or $verifiedLocation -ne $Location) {
        Write-Output 'status=failed'
        Write-Output "requested_subscription_id=$SubscriptionId"
        Write-Output "requested_location=$Location"
        Write-Output "verified_subscription_id=$verifiedSubscriptionId"
        Write-Output "verified_location=$verifiedLocation"
        throw 'azd context verification failed.'
    }
} else {
    $verifiedSubscriptionId = $existingSubscriptionId
    $verifiedLocation = $existingLocation
}

$status = if ($DetectOnly) { 'detected' } else { 'success' }
Write-Output "status=$status"
Write-Output "azd_environment=$azdEnvironment"
Write-Output "detected_existing_subscription_id=$existingSubscriptionId"
Write-Output "detected_existing_location=$existingLocation"
Write-Output "detected_default_subscription_id=$defaultSubscriptionId"
Write-Output "detected_default_location=$defaultLocation"
Write-Output "detected_az_subscription_name=$azSubscriptionName"
Write-Output "detected_az_subscription_id=$azSubscriptionId"
Write-Output "requested_subscription_id=$SubscriptionId"
Write-Output "requested_location=$Location"
Write-Output "verified_subscription_id=$verifiedSubscriptionId"
Write-Output "verified_location=$verifiedLocation"

Write-Output ''
Write-Output 'AZD context summary:'
Write-Output "  Environment: $(if ($azdEnvironment) { $azdEnvironment } else { '<selected/default>' })"
Write-Output "  Existing azd values: subscription=$(if ($existingSubscriptionId) { $existingSubscriptionId } else { '<unset>' }), location=$(if ($existingLocation) { $existingLocation } else { '<unset>' })"
Write-Output "  Defaults: subscription=$(if ($defaultSubscriptionId) { $defaultSubscriptionId } else { '<unset>' }), location=$(if ($defaultLocation) { $defaultLocation } else { '<unset>' })"
Write-Output "  Azure CLI current: $(if ($azSubscriptionName) { $azSubscriptionName } else { '<unknown>' }) ($(if ($azSubscriptionId) { $azSubscriptionId } else { '<unknown>' }))"
if ($DetectOnly) {
    Write-Output '  Action: detection only; no azd values changed.'
} else {
    Write-Output "  Applied and verified: subscription=$verifiedSubscriptionId, location=$verifiedLocation"
}
