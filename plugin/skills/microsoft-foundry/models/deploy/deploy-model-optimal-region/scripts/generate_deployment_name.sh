#!/bin/bash
#
# generate_deployment_name.sh
#
# Generate a unique deployment name based on model name and existing deployments
# Follows the same logic as UX: azure-ai-foundry/app/components/models/utils/deploymentUtil.ts:getDefaultDeploymentName
#
# Usage:
#   generate_deployment_name.sh <account-name> <resource-group> <model-name>
#
# Example:
#   generate_deployment_name.sh "my-account" "rg-prod" "gpt-4o"
#
# Returns:
#   Unique deployment name (e.g., "gpt-4o", "gpt-4o-2", "gpt-4o-3")
#

set -e

# Check arguments
if [ $# -ne 3 ]; then
  echo "Error: Invalid number of arguments" >&2
  echo "Usage: $0 <account-name> <resource-group> <model-name>" >&2
  exit 1
fi

ACCOUNT_NAME="$1"
RESOURCE_GROUP="$2"
MODEL_NAME="$3"

MAX_NAME_LENGTH=64
MIN_NAME_LENGTH=2

# Sanitize model name: keep only alphanumeric, dots, hyphens
# Remove all other special characters
SANITIZED_NAME=$(echo "$MODEL_NAME" | sed 's/[^a-zA-Z0-9.-]//g')

# Ensure length constraints
SANITIZED_NAME="${SANITIZED_NAME:0:$MAX_NAME_LENGTH}"

# Pad to minimum length if needed
if [ ${#SANITIZED_NAME} -lt $MIN_NAME_LENGTH ]; then
  SANITIZED_NAME=$(printf "%-${MIN_NAME_LENGTH}s" "$SANITIZED_NAME" | tr ' ' '_')
fi

# Get existing deployment names (lowercase for case-insensitive comparison)
EXISTING_NAMES=$(az cognitiveservices account deployment list \
  --name "$ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].name" -o tsv 2>/dev/null | tr '[:upper:]' '[:lower:]')

# Check if base name is unique
NEW_DEPLOYMENT_NAME="$SANITIZED_NAME"

if echo "$EXISTING_NAMES" | grep -qxiF "$NEW_DEPLOYMENT_NAME"; then
  # Name exists, append numeric suffix
  NUM=2
  while true; do
    SUFFIX="-${NUM}"
    SUFFIX_LENGTH=${#SUFFIX}
    BASE_LENGTH=$((MAX_NAME_LENGTH - SUFFIX_LENGTH))

    # Truncate base name if needed to fit suffix
    BASE_NAME="${SANITIZED_NAME:0:$BASE_LENGTH}"
    NEW_DEPLOYMENT_NAME="${BASE_NAME}${SUFFIX}"

    # Check if this name is unique
    if ! echo "$EXISTING_NAMES" | grep -qxiF "$NEW_DEPLOYMENT_NAME"; then
      break
    fi

    NUM=$((NUM + 1))
  done
fi

# Return the unique name
echo "$NEW_DEPLOYMENT_NAME"
