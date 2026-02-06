# generate_deployment_name.ps1
#
# Generate a unique deployment name based on model name and existing deployments
# Follows the same logic as UX: azure-ai-foundry/app/components/models/utils/deploymentUtil.ts:getDefaultDeploymentName
#
# Usage:
#   .\generate_deployment_name.ps1 -AccountName <account> -ResourceGroup <rg> -ModelName <model>
#
# Example:
#   .\generate_deployment_name.ps1 -AccountName "my-account" -ResourceGroup "rg-prod" -ModelName "gpt-4o"
#
# Returns:
#   Unique deployment name (e.g., "gpt-4o", "gpt-4o-2", "gpt-4o-3")
#

param(
    [Parameter(Mandatory=$true)]
    [string]$AccountName,

    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory=$true)]
    [string]$ModelName
)

$ErrorActionPreference = "Stop"

$MaxNameLength = 64
$MinNameLength = 2

# Sanitize model name: keep only alphanumeric, dots, hyphens
$SanitizedName = $ModelName -replace '[^\w.-]', ''

# Ensure length constraints
if ($SanitizedName.Length -gt $MaxNameLength) {
    $SanitizedName = $SanitizedName.Substring(0, $MaxNameLength)
}

# Pad to minimum length if needed
if ($SanitizedName.Length -lt $MinNameLength) {
    $SanitizedName = $SanitizedName.PadRight($MinNameLength, '_')
}

# Get existing deployment names (convert to lowercase for case-insensitive comparison)
$ExistingNamesJson = az cognitiveservices account deployment list `
    --name $AccountName `
    --resource-group $ResourceGroup `
    --query "[].name" -o json 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to list existing deployments"
    exit 1
}

$ExistingNames = @()
if ($ExistingNamesJson) {
    $ExistingNames = ($ExistingNamesJson | ConvertFrom-Json) | ForEach-Object { $_.ToLower() }
}

# Check if base name is unique
$NewDeploymentName = $SanitizedName

if ($ExistingNames -contains $NewDeploymentName.ToLower()) {
    # Name exists, append numeric suffix
    $Num = 2
    while ($true) {
        $Suffix = "-$Num"
        $SuffixLength = $Suffix.Length
        $BaseLength = $MaxNameLength - $SuffixLength

        # Truncate base name if needed to fit suffix
        $BaseName = $SanitizedName.Substring(0, [Math]::Min($BaseLength, $SanitizedName.Length))
        $NewDeploymentName = "$BaseName$Suffix"

        # Check if this name is unique (case-insensitive)
        if ($ExistingNames -notcontains $NewDeploymentName.ToLower()) {
            break
        }

        $Num++
    }
}

# Return the unique name
Write-Output $NewDeploymentName
