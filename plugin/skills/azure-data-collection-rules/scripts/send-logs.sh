#!/bin/bash
# Sends sample data to Azure Monitor via the Log Ingestion API.
# Uses Azure CLI for authentication (no secrets needed).
# Usage: ./send-logs.sh -e <endpoint-uri> -d <dcr-immutable-id> -s <stream-name> -f <data-file>
# Requires: Azure CLI (az) logged in, jq, curl

usage() {
    echo "Usage: ./send-logs.sh -e <endpoint-uri> -d <dcr-immutable-id> -s <stream-name> -f <data-file>"
    exit 1
}

while getopts "e:d:s:f:" opt; do
    case $opt in
        e) ENDPOINT_URI="$OPTARG" ;;
        d) DCR_IMMUTABLE_ID="$OPTARG" ;;
        s) STREAM_NAME="$OPTARG" ;;
        f) DATA_FILE="$OPTARG" ;;
        *) usage ;;
    esac
done

# Parameter validation
[ -z "$ENDPOINT_URI" ] && echo "ERROR: endpoint-uri is required." >&2 && usage
[ -z "$DCR_IMMUTABLE_ID" ] && echo "ERROR: dcr-immutable-id is required." >&2 && usage
[ -z "$STREAM_NAME" ] && echo "ERROR: stream-name is required." >&2 && usage
[ -z "$DATA_FILE" ] && echo "ERROR: data-file is required." >&2 && usage

if [ ! -f "$DATA_FILE" ]; then
    echo "ERROR: Data file not found: $DATA_FILE" >&2
    exit 1
fi

# Validate JSON array
if ! jq empty "$DATA_FILE" 2>/dev/null; then
    echo "ERROR: Invalid JSON in $DATA_FILE" >&2
    exit 1
fi

RECORD_COUNT=$(jq 'length' "$DATA_FILE")
if [ "$RECORD_COUNT" -eq 0 ]; then
    echo "ERROR: Data file contains no records" >&2
    exit 1
fi

# Get token via Azure CLI
TOKEN=$(az account get-access-token --resource "https://monitor.azure.com" --query accessToken -o tsv 2>&1)
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to get token via Azure CLI. Run 'az login' first. Error: $TOKEN" >&2
    exit 1
fi

# Send data
SEND_URI="${ENDPOINT_URI}/dataCollectionRules/${DCR_IMMUTABLE_ID}/streams/${STREAM_NAME}?api-version=2023-01-01"

HTTP_CODE=$(curl -s -o /tmp/send-logs-response.txt -w "%{http_code}" \
    -X POST "$SEND_URI" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @"$DATA_FILE")

if [ "$HTTP_CODE" -eq 204 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo "Data sent successfully. Records: $RECORD_COUNT"
else
    echo "ERROR: Failed to send data. HTTP status: $HTTP_CODE" >&2
    cat /tmp/send-logs-response.txt >&2
    exit 1
fi
