#!/bin/bash
# Retrieves the schema of a Log Analytics table.
# Usage: ./get-table-schema.sh -s <subscription> -g <resource-group> -w <workspace> -t <table-name>
# Requires: Azure CLI (az) logged in, jq

usage() {
    echo "Usage: ./get-table-schema.sh -s <subscription-id> -g <resource-group> -w <workspace> -t <table-name>"
    exit 1
}

API_VERSION="2022-10-01"

while getopts "s:g:w:t:" opt; do
    case $opt in
        s) SUBSCRIPTION_ID="$OPTARG" ;;
        g) RESOURCE_GROUP="$OPTARG" ;;
        w) WORKSPACE="$OPTARG" ;;
        t) TABLE_NAME="$OPTARG" ;;
        *) usage ;;
    esac
done

# Parameter validation
[ -z "$SUBSCRIPTION_ID" ] && echo "ERROR: subscription-id is required." >&2 && usage
[ -z "$RESOURCE_GROUP" ] && echo "ERROR: resource-group is required." >&2 && usage
[ -z "$WORKSPACE" ] && echo "ERROR: workspace is required." >&2 && usage
[ -z "$TABLE_NAME" ] && echo "ERROR: table-name is required." >&2 && usage

URI="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.OperationalInsights/workspaces/$WORKSPACE/tables/$TABLE_NAME?api-version=$API_VERSION"

RESPONSE=$(az rest --method get --uri "$URI" --output json 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: Failed to get table schema. $RESPONSE" >&2
    exit 1
fi

echo "Table: $(echo "$RESPONSE" | jq -r '.properties.schema.name')"
echo "Plan: $(echo "$RESPONSE" | jq -r '.properties.plan')"
echo "Retention: $(echo "$RESPONSE" | jq -r '.properties.retentionInDays') days"
echo ""
echo "Columns:"
echo "$RESPONSE" | jq -r '.properties.schema.columns[] | "  \(.name) (\(.type))"'
