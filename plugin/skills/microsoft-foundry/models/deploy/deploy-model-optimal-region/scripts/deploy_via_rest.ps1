# deploy_via_rest.ps1
#
# Deploy an Azure OpenAI model using ARM REST API
#
# Usage:
#   .\deploy_via_rest.ps1 -SubscriptionId <sub-id> -ResourceGroup <rg> -AccountName <account> -DeploymentName <name> -ModelName <model> -ModelVersion <version> -Capacity <capacity>
#
# Example:
#   .\deploy_via_rest.ps1 -SubscriptionId "abc123..." -ResourceGroup "rg-prod" -AccountName "my-account" -DeploymentName "gpt-4o" -ModelName "gpt-4o" -ModelVersion "2024-11-20" -Capacity 50
#
# Returns:
#   JSON response from ARM API with deployment details
#

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory=$true)]
    [string]$AccountName,

    [Parameter(Mandatory=$true)]
    [string]$DeploymentName,

    [Parameter(Mandatory=$true)]
    [string]$ModelName,

    [Parameter(Mandatory=$true)]
    [string]$ModelVersion,

    [Parameter(Mandatory=$true)]
    [int]$Capacity
)

$ErrorActionPreference = "Stop"

# Validate capacity is a positive integer
if ($Capacity -le 0) {
    Write-Error "Capacity must be a positive integer"
    exit 1
}

# Construct ARM REST API URL
$ApiUrl = "https://management.azure.com/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$AccountName/deployments/$DeploymentName?api-version=2024-10-01"

# Construct JSON payload
$Payload = @{
    properties = @{
        model = @{
            format = "OpenAI"
            name = $ModelName
            version = $ModelVersion
        }
        versionUpgradeOption = "OnceNewDefaultVersionAvailable"
        raiPolicyName = "Microsoft.DefaultV2"
    }
    sku = @{
        name = "GlobalStandard"
        capacity = $Capacity
    }
} | ConvertTo-Json -Depth 10

# Make ARM REST API call
az rest --method PUT --url $ApiUrl --body $Payload
