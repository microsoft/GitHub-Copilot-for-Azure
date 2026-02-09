#!/bin/bash
# query_capacity.sh
# Queries available capacity for an Azure OpenAI model.
#
# Usage:
#   ./query_capacity.sh <model-name> [model-version] [region] [sku]
# Examples:
#   ./query_capacity.sh o3-mini                          # List versions
#   ./query_capacity.sh o3-mini 2025-01-31               # All regions
#   ./query_capacity.sh o3-mini 2025-01-31 eastus2       # Specific region
#   ./query_capacity.sh o3-mini 2025-01-31 "" Standard   # Different SKU

set -euo pipefail

MODEL_NAME="${1:?Usage: $0 <model-name> [model-version] [region] [sku]}"
MODEL_VERSION="${2:-}"
REGION="${3:-}"
SKU="${4:-GlobalStandard}"

SUB_ID=$(az account show --query id -o tsv)

# If no version, list available versions
if [ -z "$MODEL_VERSION" ]; then
    LOC="${REGION:-eastus}"
    echo "Available versions for $MODEL_NAME:"
    az cognitiveservices model list --location "$LOC" \
        --query "[?model.name=='$MODEL_NAME'].{Version:model.version, Format:model.format}" \
        --output table 2>/dev/null
    exit 0
fi

# Build URL
if [ -n "$REGION" ]; then
    URL="https://management.azure.com/subscriptions/${SUB_ID}/providers/Microsoft.CognitiveServices/locations/${REGION}/modelCapacities"
else
    URL="https://management.azure.com/subscriptions/${SUB_ID}/providers/Microsoft.CognitiveServices/modelCapacities"
fi

# Query and filter by SKU, show available > 0
az rest --method GET --url "$URL" \
    --url-parameters api-version=2024-10-01 modelFormat=OpenAI modelName="$MODEL_NAME" modelVersion="$MODEL_VERSION" \
    --query "value[?properties.skuName=='$SKU' && properties.availableCapacity>\`0\`].{Region:location, SKU:properties.skuName, Available:properties.availableCapacity}" \
    --output table 2>/dev/null
