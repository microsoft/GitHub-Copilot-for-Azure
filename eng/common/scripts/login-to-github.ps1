#!/usr/bin/env pwsh
#Requires -Version 7
# Mints GitHub App installation tokens using the Azure SDK Automation key in Key Vault and exports them as secret CI variables.
# Exit codes: 0 = success, 1 = authentication or API failure, 2 = invalid arguments.

[CmdletBinding()]
param(
    [string] $KeyVaultName = 'azuresdkengkeyvault',
    [string] $KeyName = 'azure-sdk-automation',
    [string] $GitHubAppId = '1086291',
    [string[]] $InstallationTokenOwners = @('Azure'),
    [string] $VariableNamePrefix = 'GH_TOKEN',
    [switch] $AlwaysUseOwnerSuffix,
    [switch] $ExportAsOutputVariable
)

Set-StrictMode -Version Latest

$gitHubApiBaseUrl = 'https://api.github.com'
$gitHubApiVersion = '2022-11-28'

function ConvertTo-Base64Url {
    param(
        [string] $Value,
        [switch] $ValueIsBase64
    )

    $base64 = if ($ValueIsBase64) {
        $Value
    }
    else {
        [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
    }

    return $base64.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-GitHubHeaders {
    param(
        [string] $Token
    )

    return @{
        Authorization = "Bearer $Token"
        Accept = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = $gitHubApiVersion
        'User-Agent' = 'ghcfa-ado-github-app'
    }
}

function New-GitHubAppJwt {
    $header = @{
        alg = 'RS256'
        typ = 'JWT'
    }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $payload = @{
        iat = $now - 10
        exp = $now + 600
        iss = $GitHubAppId
    }

    $encodedHeader = ConvertTo-Base64Url -Value ($header | ConvertTo-Json -Compress)
    $encodedPayload = ConvertTo-Base64Url -Value ($payload | ConvertTo-Json -Compress)
    $unsignedToken = "$encodedHeader.$encodedPayload"
    $digestBytes = [Security.Cryptography.SHA256]::HashData(
        [Text.Encoding]::ASCII.GetBytes($unsignedToken)
    )
    $digest = [Convert]::ToBase64String($digestBytes)

    $signOutput = & az keyvault key sign `
        --vault-name $KeyVaultName `
        --name $KeyName `
        --algorithm RS256 `
        --digest $digest `
        --only-show-errors `
        --output json
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI failed to sign the GitHub App JWT; exit code $LASTEXITCODE."
    }

    $signResult = $signOutput | ConvertFrom-Json -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace([string] $signResult.signature)) {
        throw 'Azure Key Vault did not return a signature for the GitHub App JWT.'
    }

    $signature = ConvertTo-Base64Url -Value $signResult.signature -ValueIsBase64
    return "$unsignedToken.$signature"
}

function Get-PropertyValue {
    param(
        [AllowNull()]
        [object] $InputObject,
        [string] $PropertyName
    )

    if ($null -eq $InputObject) {
        return $null
    }

    if ($InputObject -is [Collections.IDictionary]) {
        if ($InputObject.Contains($PropertyName)) {
            return $InputObject[$PropertyName]
        }

        return $null
    }

    $property = $InputObject.PSObject.Properties[$PropertyName]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Get-GitHubInstallationId {
    param(
        [string] $Jwt,
        [string] $Owner
    )

    $response = Invoke-RestMethod `
        -Method Get `
        -Uri "$gitHubApiBaseUrl/app/installations" `
        -Headers (Get-GitHubHeaders -Token $Jwt) `
        -TimeoutSec 30 `
        -MaximumRetryCount 3 `
        -ErrorAction Stop

    $matches = @($response | Where-Object {
        $login = Get-PropertyValue -InputObject $_ -PropertyName 'login'
        if ([string]::IsNullOrWhiteSpace([string] $login)) {
            $account = Get-PropertyValue -InputObject $_ -PropertyName 'account'
            $login = Get-PropertyValue -InputObject $account -PropertyName 'login'
        }

        $login -ieq $Owner
    })
    if ($matches.Count -eq 0) {
        throw "The Azure SDK Automation GitHub App is not installed for '$Owner'."
    }
    if ($matches.Count -gt 1) {
        Write-Warning "Multiple GitHub App installations matched '$Owner'; using the first."
    }

    $installationId = Get-PropertyValue -InputObject $matches[0] -PropertyName 'id'
    if ([string]::IsNullOrWhiteSpace([string] $installationId)) {
        throw "The GitHub App installation for '$Owner' did not include an installation ID."
    }

    return [string] $installationId
}

function New-GitHubInstallationToken {
    param(
        [string] $Jwt,
        [string] $InstallationId
    )

    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "$gitHubApiBaseUrl/app/installations/$InstallationId/access_tokens" `
        -Headers (Get-GitHubHeaders -Token $Jwt) `
        -TimeoutSec 30 `
        -MaximumRetryCount 3 `
        -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace([string] $response.token)) {
        throw "GitHub did not return an access token for installation '$InstallationId'."
    }

    return [string] $response.token
}

function Export-SecretVariable {
    param(
        [string] $Name,
        [string] $Value
    )

    Set-Item -Path "Env:$Name" -Value $Value

    if (-not [string]::IsNullOrWhiteSpace($env:SYSTEM_TEAMPROJECTID)) {
        Write-Host "##vso[task.setvariable variable=$Name;issecret=true]$Value"
        if ($ExportAsOutputVariable) {
            Write-Host "##vso[task.setvariable variable=$Name;issecret=true;isOutput=true]$Value"
        }
    }

    if ($env:GITHUB_ACTIONS -eq 'true') {
        Write-Host ('::add-mask::' + $Value)
        Add-Content -LiteralPath $env:GITHUB_ENV -Value "$Name=$Value" -ErrorAction Stop
    }
}

if ([string]::IsNullOrWhiteSpace($KeyVaultName) -or
    [string]::IsNullOrWhiteSpace($KeyName) -or
    [string]::IsNullOrWhiteSpace($GitHubAppId) -or
    [string]::IsNullOrWhiteSpace($VariableNamePrefix) -or
    $InstallationTokenOwners.Count -eq 0 -or
    @($InstallationTokenOwners | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) {
    Write-Error 'KeyVaultName, KeyName, GitHubAppId, VariableNamePrefix, and at least one installation owner are required.'
    exit 2
}
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error 'Azure CLI was not found on PATH.'
    exit 1
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error 'GitHub CLI was not found on PATH.'
    exit 1
}

try {
    $jwt = New-GitHubAppJwt
    foreach ($installationTokenOwner in $InstallationTokenOwners) {
        $normalizedOwner = ($installationTokenOwner -split '/', 2)[0]
        $installationId = Get-GitHubInstallationId -Jwt $jwt -Owner $normalizedOwner
        $installationToken = New-GitHubInstallationToken `
            -Jwt $jwt `
            -InstallationId $installationId

        $variableName = $VariableNamePrefix
        if ($AlwaysUseOwnerSuffix -or $InstallationTokenOwners.Count -gt 1) {
            $variableName = "${VariableNamePrefix}_$normalizedOwner"
        }

        Export-SecretVariable -Name $variableName -Value $installationToken
        Write-Host "Exported GitHub App token variable '$variableName' for '$normalizedOwner'."

        $previousToken = $env:GH_TOKEN
        try {
            $env:GH_TOKEN = $installationToken
            & gh auth status
            if ($LASTEXITCODE -ne 0) {
                throw "GitHub CLI authentication validation failed with exit code $LASTEXITCODE."
            }
        }
        finally {
            $env:GH_TOKEN = $previousToken
        }
    }
}
catch {
    Write-Error $_
    exit 1
}
