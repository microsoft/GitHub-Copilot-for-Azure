# Initialize an AZD template, set location, then provision and deploy.
#
# USAGE:
#   .\azd-provision-deploy.ps1 -Template <template> -Region <region> [-EnvName <env-name>] [-UseUp] [-InitOnly]
#
# ARGUMENTS:
#   Template   AZD template name or repository.
#   Region     Azure region for AZURE_LOCATION.
#   EnvName    Optional AZD environment name. Defaults to <cwd-slug>-dev.
#   UseUp      Use azd up --no-prompt instead of provision, wait, deploy.
#   InitOnly   Initialize the template and exit.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Template,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Region,

    [Parameter(Position = 2)]
    [string]$EnvName,

    [switch]$UseUp,

    [switch]$InitOnly
)

$ErrorActionPreference = 'Stop'

if (-not $EnvName) {
    $slug = (Split-Path -Leaf (Get-Location)).ToLower() -replace '[ _]', '-'
    $EnvName = "$slug-dev"
}

if ($InitOnly) {
    $mode = 'init-only'
    $phases = 'init'
} elseif ($UseUp) {
    $mode = 'up'
    $phases = 'init,env-set,up'
} else {
    $mode = 'provision-deploy'
    $phases = 'init,env-set,provision,wait,deploy'
}

Write-Host "env_name=$EnvName"
Write-Host "template=$Template"
Write-Host "region=$Region"
Write-Host "mode=$mode"
Write-Host "phases=$phases"

if (Test-Path 'azure.yaml') {
    Write-Host 'init=skipped-existing-azure-yaml'
} else {
    azd init -t $Template -e $EnvName --no-prompt
    Write-Host 'init=completed'
}

if ($InitOnly) {
    Write-Host 'result=initialized'
    Write-Host "Initialized '$EnvName' from '$Template'."
    exit 0
}

azd env set AZURE_LOCATION $Region

if ($UseUp) {
    azd up --no-prompt
    Write-Host 'result=deployed-with-azd-up'
    Write-Host "Initialized and deployed '$EnvName' in '$Region' with azd up."
} else {
    azd provision --no-prompt
    Start-Sleep -Seconds 60
    azd deploy --no-prompt
    Write-Host 'result=provisioned-then-deployed'
    Write-Host "Provisioned then deployed '$EnvName' in '$Region'."
}