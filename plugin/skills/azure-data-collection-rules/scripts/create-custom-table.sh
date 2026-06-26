#!/bin/bash
# Creates or updates a custom Log Analytics table.
# Usage: ./create-custom-table.sh -s <subscription> -g <resource-group> -w <workspace> -t <table-name> -f <schema-file>
# Requires: Azure CLI (az) logged in, jq

usage() {
    echo "Usage: ./create-custom-table.sh -s <subscription-id> -g <resource-group> -w <workspace> -t <table-name> -f <schema-file> [-r <retention>] [-T <total-retention>] [-p <plan>]"
    exit 1
}

RETENTION=30
TOTAL_RETENTION=90
PLAN="Analytics"
API_VERSION="2022-10-01"

while getopts "s:g:w:t:f:r:T:p:" opt; do
    case $opt in
        s) SUBSCRIPTION_ID="$OPTARG" ;;
        g) RESOURCE_GROUP="$OPTARG" ;;
        w) WORKSPACE="$OPTARG" ;;
        t) TABLE_NAME="$OPTARG" ;;
        f) SCHEMA_FILE="$OPTARG" ;;
        r) RETENTION="$OPTARG" ;;
        T) TOTAL_RETENTION="$OPTARG" ;;
        p) PLAN="$OPTARG" ;;
        *) usage ;;
    esac
done

# Parameter validation
[ -z "$SUBSCRIPTION_ID" ] && echo "ERROR: subscription-id is required." >&2 && usage
[ -z "$RESOURCE_GROUP" ] && echo "ERROR: resource-group is required." >&2 && usage
[ -z "$WORKSPACE" ] && echo "ERROR: workspace is required." >&2 && usage
[ -z "$TABLE_NAME" ] && echo "ERROR: table-name is required." >&2 && usage
[ -z "$SCHEMA_FILE" ] && echo "ERROR: schema-file is required." >&2 && usage

if [[ "$TABLE_NAME" != *_CL ]]; then
    echo "ERROR: Custom table name must end with '_CL'" >&2
    exit 1
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "ERROR: Schema file not found: $SCHEMA_FILE" >&2
    exit 1
fi

# Verify TimeGenerated column exists
HAS_TG=$(jq '[.columns[] | select(.name == "TimeGenerated" and .type == "datetime")] | length' "$SCHEMA_FILE")
if [ "$HAS_TG" -eq 0 ]; then
    echo "ERROR: Schema must include a 'TimeGenerated' column of type 'datetime'" >&2
    exit 1
fi

# Build body
BODY=$(jq -n --arg name "$TABLE_NAME" --argjson cols "$(jq '.columns' "$SCHEMA_FILE")" \
    --argjson ret "$RETENTION" --argjson totRet "$TOTAL_RETENTION" --arg plan "$PLAN" \
    '{properties: {schema: {name: $name, columns: $cols}, retentionInDays: $ret, totalRetentionInDays: $totRet, plan: $plan}}')

URI="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.OperationalInsights/workspaces/$WORKSPACE/tables/$TABLE_NAME?api-version=$API_VERSION"

RESPONSE=$(az rest --method put --uri "$URI" --body "$BODY" --output json 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: Failed to create/update table. $RESPONSE" >&2
    exit 1
fi

echo "Table '$TABLE_NAME' created/updated successfully."
