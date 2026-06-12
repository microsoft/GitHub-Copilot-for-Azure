#!/bin/bash
# Detect, apply, and verify azd subscription/location context.
#
# USAGE:
#   ./set-azd-context.sh <subscription-id> <location> [environment-name]
#   ./set-azd-context.sh --detect-only [environment-name]
#
# OUTPUT:
#   Machine-readable key=value lines followed by a human-readable summary.

set -euo pipefail

DETECT_ONLY="false"
if [ "${1:-}" = "--detect-only" ]; then
  DETECT_ONLY="true"
  SUBSCRIPTION_ID=""
  LOCATION=""
  ENVIRONMENT_NAME="${2:-}"
else
  SUBSCRIPTION_ID="${1:-}"
  LOCATION="${2:-}"
  ENVIRONMENT_NAME="${3:-}"
  if [ -z "$SUBSCRIPTION_ID" ] || [ -z "$LOCATION" ]; then
    echo "ERROR: Usage: $0 <subscription-id> <location> [environment-name]" >&2
    echo "       or: $0 --detect-only [environment-name]" >&2
    exit 1
  fi
fi

strip_quotes() {
  value="${1%$'\r'}"
  case "$value" in
    \"*\") value=${value#\"}; value=${value%\"} ;;
    \'*\') value=${value#\'}; value=${value%\'} ;;
  esac
  printf '%s' "$value"
}

json_prop() {
  prop="$1"
  sed -n "s/.*\"$prop\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

load_azd_values() {
  AZD_SUBSCRIPTION_ID=""
  AZD_LOCATION=""
  if values=$(azd env get-values 2>/dev/null); then
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      key=${line%%=*}
      value=$(strip_quotes "${line#*=}")
      case "$key" in
        AZURE_SUBSCRIPTION_ID) AZD_SUBSCRIPTION_ID="$value" ;;
        AZURE_LOCATION) AZD_LOCATION="$value" ;;
      esac
    done <<EOF
$values
EOF
  fi
}

AZD_ENVIRONMENT="$ENVIRONMENT_NAME"
if [ -n "$AZD_ENVIRONMENT" ]; then
  azd env select "$AZD_ENVIRONMENT" >/dev/null
fi

AZD_ENV_LIST=$(azd env list 2>/dev/null || true)
if [ -z "$AZD_ENVIRONMENT" ]; then
  AZD_ENVIRONMENT=$(printf '%s\n' "$AZD_ENV_LIST" | awk '/^\*/ { print $2; exit }')
fi

load_azd_values
EXISTING_SUBSCRIPTION_ID="$AZD_SUBSCRIPTION_ID"
EXISTING_LOCATION="$AZD_LOCATION"

DEFAULT_SUBSCRIPTION_ID=""
DEFAULT_LOCATION=""
if defaults_json=$(azd config get defaults 2>/dev/null); then
  DEFAULT_SUBSCRIPTION_ID=$(printf '%s' "$defaults_json" | json_prop subscription)
  DEFAULT_LOCATION=$(printf '%s' "$defaults_json" | json_prop location)
fi

AZ_SUBSCRIPTION_NAME=""
AZ_SUBSCRIPTION_ID=""
if account_json=$(az account show --query "{name:name, id:id}" -o json 2>/dev/null); then
  AZ_SUBSCRIPTION_NAME=$(printf '%s' "$account_json" | json_prop name)
  AZ_SUBSCRIPTION_ID=$(printf '%s' "$account_json" | json_prop id)
fi

if [ "$DETECT_ONLY" = "false" ]; then
  azd env set AZURE_SUBSCRIPTION_ID "$SUBSCRIPTION_ID" >/dev/null
  azd env set AZURE_LOCATION "$LOCATION" >/dev/null

  load_azd_values
  if [ "$AZD_SUBSCRIPTION_ID" != "$SUBSCRIPTION_ID" ] || [ "$AZD_LOCATION" != "$LOCATION" ]; then
    echo "status=failed"
    echo "requested_subscription_id=$SUBSCRIPTION_ID"
    echo "requested_location=$LOCATION"
    echo "verified_subscription_id=$AZD_SUBSCRIPTION_ID"
    echo "verified_location=$AZD_LOCATION"
    echo "ERROR: azd context verification failed." >&2
    exit 1
  fi
fi

STATUS="success"
[ "$DETECT_ONLY" = "true" ] && STATUS="detected"

echo "status=$STATUS"
echo "azd_environment=$AZD_ENVIRONMENT"
echo "detected_existing_subscription_id=$EXISTING_SUBSCRIPTION_ID"
echo "detected_existing_location=$EXISTING_LOCATION"
echo "detected_default_subscription_id=$DEFAULT_SUBSCRIPTION_ID"
echo "detected_default_location=$DEFAULT_LOCATION"
echo "detected_az_subscription_name=$AZ_SUBSCRIPTION_NAME"
echo "detected_az_subscription_id=$AZ_SUBSCRIPTION_ID"
echo "requested_subscription_id=$SUBSCRIPTION_ID"
echo "requested_location=$LOCATION"
echo "verified_subscription_id=$AZD_SUBSCRIPTION_ID"
echo "verified_location=$AZD_LOCATION"

echo ""
echo "AZD context summary:"
echo "  Environment: ${AZD_ENVIRONMENT:-<selected/default>}"
echo "  Existing azd values: subscription=${EXISTING_SUBSCRIPTION_ID:-<unset>}, location=${EXISTING_LOCATION:-<unset>}"
echo "  Defaults: subscription=${DEFAULT_SUBSCRIPTION_ID:-<unset>}, location=${DEFAULT_LOCATION:-<unset>}"
echo "  Azure CLI current: ${AZ_SUBSCRIPTION_NAME:-<unknown>} (${AZ_SUBSCRIPTION_ID:-<unknown>})"
if [ "$DETECT_ONLY" = "true" ]; then
  echo "  Action: detection only; no azd values changed."
else
  echo "  Applied and verified: subscription=$AZD_SUBSCRIPTION_ID, location=$AZD_LOCATION"
fi
