<#
.SYNOPSIS
    Checks a service connection principal's read access without cloning.
.DESCRIPTION
    Exit codes: 0 = repository read access verified; 1 = configuration,
    authentication or repository access check failed.
#>
param(
    [string]$ConnectionName,
    [string]$ExpectedTenantId
)

Set-StrictMode -Version Latest
Set-PSDebug -Off

if ([string]::IsNullOrWhiteSpace($ConnectionName)) {
    throw 'ConnectionName is required.'
}
if ($env:SYSTEM_DEBUG -eq 'true') {
    throw 'Disable System.Debug for the repository access check.'
}

$accountJson = az account show --query '{tenantId:tenantId,subscriptionId:id,identityType:user.type,clientId:user.name}' -o json --only-show-errors
if ($LASTEXITCODE -ne 0) {
    throw "${ConnectionName}: unable to read the Azure CLI identity."
}
$account = $accountJson | ConvertFrom-Json -ErrorAction Stop
if ($account.identityType -ne 'servicePrincipal') {
    throw "${ConnectionName}: this check requires a service principal login, not a user login."
}
if ($ExpectedTenantId -and $account.tenantId -ne $ExpectedTenantId) {
    throw "${ConnectionName}: active tenant does not match ExpectedTenantId."
}
Write-Host "${ConnectionName}: tenant=$($account.tenantId); subscription=$($account.subscriptionId); app/client=$($account.clientId)"

$repositoryUrl = 'https://dev.azure.com/devdiv/OnlineServices/_git/msbench-benchmarks'
$gitEnvironment = @{
    GIT_CONFIG_COUNT = '3'
    GIT_CONFIG_KEY_0 = 'http.extraheader'
    GIT_CONFIG_VALUE_0 = ''
    GIT_CONFIG_KEY_1 = 'http.extraheader'
    GIT_CONFIG_VALUE_1 = ''
    GIT_CONFIG_KEY_2 = 'credential.helper'
    GIT_CONFIG_VALUE_2 = ''
    GIT_TERMINAL_PROMPT = '0'
    GIT_TRACE = '0'
    GIT_TRACE_CURL = '0'
    GIT_CURL_VERBOSE = '0'
}
$savedEnvironment = @{}
foreach ($name in $gitEnvironment.Keys) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
}

$token = $null
$escaped = $null
$probeOutput = $null
try {
    $token = az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv --only-show-errors
    if ($LASTEXITCODE -ne 0 -or $token -isnot [string] -or [string]::IsNullOrWhiteSpace($token)) {
        throw "${ConnectionName}: Azure DevOps token acquisition failed."
    }
    if ($env:TF_BUILD -eq 'True') {
        $escaped = $token.Replace('%', '%AZP25').Replace("`r", '%0D').Replace("`n", '%0A')
        Write-Host "##vso[task.setsecret]$escaped"
    }
    $gitEnvironment.GIT_CONFIG_VALUE_1 = "AUTHORIZATION: bearer $token"
    foreach ($name in $gitEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $gitEnvironment[$name])
    }

    $probeOutput = git -c core.askPass= -c http.followRedirects=false ls-remote --exit-code --quiet $repositoryUrl HEAD 2>&1
    $gitExitCode = $LASTEXITCODE
    if ($gitExitCode -ne 0) {
        $diagnostic = $probeOutput | Out-String
        # Report useful failure categories, never raw HTTP diagnostics or headers.
        $reason = 'repository probe failed'
        if ($diagnostic -match 'TF401019') {
            $reason = 'TF401019: repository is unavailable or this principal lacks permission'
        } elseif ($diagnostic -match 'TF400813') {
            $reason = 'TF400813: principal is not authorized'
        } elseif ($diagnostic -match '403') {
            $reason = 'HTTP 403: access forbidden'
        } elseif ($diagnostic -match '401|Authentication failed') {
            $reason = 'authentication rejected'
        } elseif ($diagnostic -match 'Could not resolve|Failed to connect|timed out') {
            $reason = 'network failure; permissions could not be determined'
        }
        throw "${ConnectionName}: $reason (git exit code $gitExitCode)."
    }
    Write-Host "${ConnectionName}: PASS - repository HEAD is readable. No clone performed; credential-helper fallback disabled."
}
finally {
    foreach ($name in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name])
    }
    $gitEnvironment.GIT_CONFIG_VALUE_1 = ''
    $token = $null
    $escaped = $null
    $probeOutput = $null
}
