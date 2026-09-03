<#
.SYNOPSIS
    Set the signed-in user's identity as the Azure SQL Entra administrator in an azd environment.

.DESCRIPTION
    Resolves the signed-in Azure user's object ID and display name, then sets
    AZURE_PRINCIPAL_ID and AZURE_PRINCIPAL_NAME in one azd environment update.

    Exit codes:
      0 - Variables set successfully, or help displayed
      1 - A dependency, identity lookup, or azd environment update failed
      2 - Invalid arguments

.PARAMETER Environment
    Optional azd environment name. Defaults to the current/default azd environment.

.EXAMPLE
    ./set-sql-principal.ps1

.EXAMPLE
    ./set-sql-principal.ps1 -Environment my-azd-env
#>

$Environment = ''
for ($index = 0; $index -lt $args.Count; $index++) {
    switch ($args[$index]) {
        '-Environment' {
            if ($index + 1 -ge $args.Count -or [string]::IsNullOrWhiteSpace($args[$index + 1])) {
                Write-Error "-Environment requires an azd environment name."
                exit 2
            }
            $Environment = $args[++$index]
        }
        { $_ -in @('-h', '--help') } {
            Get-Help $MyInvocation.MyCommand.Path
            exit 0
        }
        default {
            Write-Error "Unknown argument: $($args[$index])"
            exit 2
        }
    }
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI ('az') is not installed or is not on PATH."
    exit 1
}

if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
    Write-Error "Azure Developer CLI ('azd') is not installed or is not on PATH."
    exit 1
}

$principalInfo = az ad signed-in-user show --query "{id:id, name:displayName}" -o tsv
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not resolve the signed-in Azure user. Run 'az login' with a user identity and retry."
    exit 1
}

$principalFields = @($principalInfo -split "`t", 2)
if ($principalFields.Count -ne 2) {
    Write-Error "Azure CLI returned incomplete signed-in user information."
    exit 1
}

$principalId = $principalFields[0].Trim()
$principalName = $principalFields[1].Trim()
if ([string]::IsNullOrWhiteSpace($principalId) -or [string]::IsNullOrWhiteSpace($principalName)) {
    Write-Error "Azure CLI returned an empty user object ID or display name."
    exit 1
}

$azdEnvArgs = @()
if (-not [string]::IsNullOrWhiteSpace($Environment)) {
    $azdEnvArgs = @('-e', $Environment)
}

azd env set @azdEnvArgs --no-prompt `
    "AZURE_PRINCIPAL_ID=$principalId" `
    "AZURE_PRINCIPAL_NAME=$principalName"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not update the azd environment. Run 'azd init' or select an environment and retry."
    exit 1
}

Write-Output "AZURE_PRINCIPAL_ID: set to $principalId"
Write-Output "AZURE_PRINCIPAL_NAME: set to $principalName"
