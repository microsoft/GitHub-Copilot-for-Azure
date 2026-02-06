#!/bin/bash
#
# deploy_via_rest.sh
#
# Deploy an Azure OpenAI model using ARM REST API
#
# Usage:
#   deploy_via_rest.sh <subscription-id> <resource-group> <account-name> <deployment-name> <model-name> <model-version> <capacity>
#
# Example:
#   deploy_via_rest.sh "abc123..." "rg-prod" "my-account" "gpt-4o" "gpt-4o" "2024-11-20" 50
#
# Returns:
#   JSON response from ARM API with deployment details
#

set -e

# Check arguments
if [ $# -ne 7 ]; then
  echo "Error: Invalid number of arguments" >&2
  echo "Usage: $0 <subscription-id> <resource-group> <account-name> <deployment-name> <model-name> <model-version> <capacity>" >&2
  exit 1
fi

SUBSCRIPTION_ID="$1"
RESOURCE_GROUP="$2"
ACCOUNT_NAME="$3"
DEPLOYMENT_NAME="$4"
MODEL_NAME="$5"
MODEL_VERSION="$6"
CAPACITY="$7"

# Validate capacity is a number
if ! [[ "$CAPACITY" =~ ^[0-9]+$ ]]; then
  echo "Error: Capacity must be a positive integer" >&2
  exit 1
fi

# Construct ARM REST API URL
API_URL="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$ACCOUNT_NAME/deployments/$DEPLOYMENT_NAME?api-version=2024-10-01"

# Construct JSON payload
# Note: Using cat with EOF for proper JSON formatting and escaping
PAYLOAD=$(cat <<EOF
{
  "properties": {
    "model": {
      "format": "OpenAI",
      "name": "$MODEL_NAME",
      "version": "$MODEL_VERSION"
    },
    "versionUpgradeOption": "OnceNewDefaultVersionAvailable",
    "raiPolicyName": "Microsoft.DefaultV2"
  },
  "sku": {
    "name": "GlobalStandard",
    "capacity": $CAPACITY
  }
}
EOF
)

# Make ARM REST API call
az rest --method PUT \
  --url "$API_URL" \
  --body "$PAYLOAD"
