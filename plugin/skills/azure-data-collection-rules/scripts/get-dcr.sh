#!/bin/bash
# Retrieves an existing Data Collection Rule via Azure CLI.
# Usage: ./get-dcr.sh -s <subscription> -g <resource-group> -n <dcr-name> [-o <output-file>]
# Requires: Azure CLI (az), logged in

usage() {
    echo "Usage: ./get-dcr.sh -s <subscription-id> -g <resource-group> -n <dcr-name> [-o <output-file>] [-a <api-version>]"
    exit 1
}

API_VERSION="2025-05-11"
OUTPUT_PATH=""

while getopts "s:g:n:o:a:" opt; do
    case $opt in
        s) SUBSCRIPTION_ID="$OPTARG" ;;
        g) RESOURCE_GROUP="$OPTARG" ;;
        n) DCR_NAME="$OPTARG" ;;
        o) OUTPUT_PATH="$OPTARG" ;;
        a) API_VERSION="$OPTARG" ;;
        *) usage ;;
    esac
done

# Parameter validation
[ -z "$SUBSCRIPTION_ID" ] && echo "ERROR: subscription-id is required." >&2 && usage
[ -z "$RESOURCE_GROUP" ] && echo "ERROR: resource-group is required." >&2 && usage
[ -z "$DCR_NAME" ] && echo "ERROR: dcr-name is required." >&2 && usage

[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH="./${DCR_NAME}.json"

URI="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/dataCollectionRules/$DCR_NAME?api-version=$API_VERSION"

RESPONSE=$(az rest --method get --uri "$URI" --output json 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: Failed to get DCR. $RESPONSE" >&2
    exit 1
fi

# Write full JSON to file
echo "$RESPONSE" | jq '.' > "$OUTPUT_PATH"

# Print summary
echo "DCR saved to: $OUTPUT_PATH"
echo "Kind: $(echo "$RESPONSE" | jq -r '.kind // "N/A"')"
echo "Provisioning: $(echo "$RESPONSE" | jq -r '.properties.provisioningState // "N/A"')"
echo "Streams: $(echo "$RESPONSE" | jq -r '[.properties.streamDeclarations // {} | keys[]] | join(", ") // "(none)"')"
echo "DataFlows: $(echo "$RESPONSE" | jq '.properties.dataFlows // [] | length')"
echo "Destinations: $(echo "$RESPONSE" | jq -r '[.properties.destinations // {} | to_entries[] | .value[] | .name // empty] | join(", ")')"
