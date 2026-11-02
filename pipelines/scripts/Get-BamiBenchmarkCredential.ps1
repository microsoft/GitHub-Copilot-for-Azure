<#
.SYNOPSIS
    Retrieves a BAMI workload client secret and exports a masked task output.
.DESCRIPTION
    Run only in the separate BAMI AzureCLI@2 task. Configuration comes from
    BAMI_KEY_VAULT and BAMI_SECRET_NAME. The service connection handles Azure login.
    Exit codes: 0 = success; 1 = authentication, configuration or retrieval failure.
#>

Set-StrictMode -Version Latest
Set-PSDebug -Off

foreach ($name in @('BAMI_KEY_VAULT', 'BAMI_SECRET_NAME')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value) -or $value.Contains('$(')) {
        throw "BAMI requires $name."
    }
}
if ($env:TF_BUILD -ne 'True') {
    throw 'Credential export requires an Azure DevOps pipeline task.'
}
if ($env:SYSTEM_DEBUG -eq 'true') {
    throw 'Disable System.Debug before retrieving BAMI credentials.'
}

$secret = $null
try {
    $secret = az keyvault secret show --vault-name $env:BAMI_KEY_VAULT --name $env:BAMI_SECRET_NAME --query value -o tsv --only-show-errors
    if ($LASTEXITCODE -ne 0) {
        throw "BAMI Key Vault retrieval failed with exit code $LASTEXITCODE."
    }
    if ($secret -isnot [string] -or [string]::IsNullOrWhiteSpace($secret)) {
        throw 'BAMI Key Vault returned an empty or invalid workload secret.'
    }
    # Escape Azure Pipelines logging-command data; never emit the raw value.
    $escaped = $secret.Replace('%', '%AZP25').Replace("`r", '%0D').Replace("`n", '%0A')
    Write-Host "##vso[task.setsecret]$escaped"
    Write-Host "##vso[task.setvariable variable=BAMI_CLIENT_SECRET;issecret=true;isoutput=true]$escaped"
}
finally {
    $secret = $null
    $escaped = $null
}
