#!/bin/bash
# Creates or updates a Data Collection Rule via Azure CLI.
# Usage: ./put-dcr.sh -s <subscription> -g <resource-group> -n <dcr-name> -f <dcr-file>
# Requires: Azure CLI (az), logged in

usage() {
    echo "Usage: ./put-dcr.sh -s <subscription-id> -g <resource-group> -n <dcr-name> -f <dcr-file> [-a <api-version>]"
    exit 1
}

API_VERSION="2025-05-11"

while getopts "s:g:n:f:a:" opt; do
    case $opt in
        s) SUBSCRIPTION_ID="$OPTARG" ;;
        g) RESOURCE_GROUP="$OPTARG" ;;
        n) DCR_NAME="$OPTARG" ;;
        f) DCR_FILE="$OPTARG" ;;
        a) API_VERSION="$OPTARG" ;;
        *) usage ;;
    esac
done

# Parameter validation
[ -z "$SUBSCRIPTION_ID" ] && echo "ERROR: subscription-id is required." >&2 && usage
[ -z "$RESOURCE_GROUP" ] && echo "ERROR: resource-group is required." >&2 && usage
[ -z "$DCR_NAME" ] && echo "ERROR: dcr-name is required." >&2 && usage
[ -z "$DCR_FILE" ] && echo "ERROR: dcr-file is required." >&2 && usage

if [ ! -f "$DCR_FILE" ]; then
    echo "ERROR: DCR file not found: $DCR_FILE" >&2
    exit 1
fi

# Validate JSON
if ! jq empty "$DCR_FILE" 2>/dev/null; then
    echo "ERROR: Invalid JSON in $DCR_FILE" >&2
    exit 1
fi

URI="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/dataCollectionRules/$DCR_NAME?api-version=$API_VERSION"

RESPONSE=$(az rest --method put --uri "$URI" --body @"$DCR_FILE" --output json 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: Failed to deploy DCR. $RESPONSE" >&2
    exit 1
fi

echo "DCR '$DCR_NAME' deployed successfully."
echo "$RESPONSE" | jq '{kind: .kind, provisioningState: .properties.provisioningState, immutableId: .properties.immutableId, logsIngestion: .properties.endpoints.logsIngestion}'
