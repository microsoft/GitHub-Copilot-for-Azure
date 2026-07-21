#!/usr/bin/env bash
# containerapp-diagnostics.sh
# Collects diagnostic information for an Azure Container App in one pass and
# prints it as clearly labeled sections: revisions, registry config, ingress
# config, and recent logs. The script only gathers and labels output; it does
# not interpret the results.
#
# Usage:
#   ./containerapp-diagnostics.sh --name <app> --resource-group <rg> [--subscription <id>]
#   ./containerapp-diagnostics.sh <app> <rg> [subscription-id]
#
# Examples:
#   ./containerapp-diagnostics.sh --name my-app --resource-group my-rg
#   ./containerapp-diagnostics.sh my-app my-rg

set -euo pipefail

APP=""
RG=""
SUBSCRIPTION=""

# Support both --flag and positional styles.
POSITIONAL=()
while [ $# -gt 0 ]; do
    case "$1" in
        --name|-n)             APP="$2"; shift 2 ;;
        --resource-group|-g)   RG="$2"; shift 2 ;;
        --subscription|-s)     SUBSCRIPTION="$2"; shift 2 ;;
        *)                     POSITIONAL+=("$1"); shift ;;
    esac
done

if [ -z "$APP" ] && [ "${#POSITIONAL[@]}" -ge 1 ]; then APP="${POSITIONAL[0]}"; fi
if [ -z "$RG" ] && [ "${#POSITIONAL[@]}" -ge 2 ]; then RG="${POSITIONAL[1]}"; fi
if [ -z "$SUBSCRIPTION" ] && [ "${#POSITIONAL[@]}" -ge 3 ]; then SUBSCRIPTION="${POSITIONAL[2]}"; fi

if [ -z "$APP" ] || [ -z "$RG" ]; then
    echo "Usage: $0 --name <app> --resource-group <rg> [--subscription <id>]" >&2
    exit 1
fi

SUB_ARGS=()
if [ -n "$SUBSCRIPTION" ]; then SUB_ARGS=(--subscription "$SUBSCRIPTION"); fi

echo "=== Container App Diagnostics: $APP (resource group: $RG) ==="
echo "Collecting revisions, registry/ingress configuration, and recent logs."
echo ""

echo "--- Revisions ---"
az containerapp revision list --name "$APP" -g "$RG" "${SUB_ARGS[@]}" -o table || echo "(failed to list revisions)"
echo ""

echo "--- Registry Config ---"
az containerapp show --name "$APP" -g "$RG" "${SUB_ARGS[@]}" \
    --query "properties.configuration.registries" || echo "(failed to read registry config)"
echo ""

echo "--- Ingress Config ---"
az containerapp show --name "$APP" -g "$RG" "${SUB_ARGS[@]}" \
    --query "properties.configuration.ingress" || echo "(failed to read ingress config)"
echo ""

echo "--- Recent Logs (last 20 lines) ---"
az containerapp logs show --name "$APP" -g "$RG" "${SUB_ARGS[@]}" --tail 20 || echo "(failed to read logs)"
echo ""

echo "=== Diagnostics collection complete for $APP ==="
