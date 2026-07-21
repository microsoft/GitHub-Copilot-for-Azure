#!/usr/bin/env bash
# appservice-diagnostics.sh
# Collects diagnostic information for an Azure App Service web app in one pass
# and prints it as clearly labeled sections: app config, recent deployments,
# app settings, and custom domains. The script only gathers and labels output;
# it does not interpret the results.
#
# Usage:
#   ./appservice-diagnostics.sh --name <app> --resource-group <rg> [--subscription <id>]
#   ./appservice-diagnostics.sh <app> <rg> [subscription-id]
#
# Examples:
#   ./appservice-diagnostics.sh --name my-app --resource-group my-rg
#   ./appservice-diagnostics.sh my-app my-rg

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

echo "=== App Service Diagnostics: $APP (resource group: $RG) ==="
echo "Collecting app config, recent deployments, app settings, and custom domains."
echo ""

echo "--- App Config ---"
az webapp show -n "$APP" -g "$RG" "${SUB_ARGS[@]}" \
    --query "{state:state, runtime:siteConfig.linuxFxVersion, healthCheck:siteConfig.healthCheckPath, alwaysOn:siteConfig.alwaysOn}" \
    -o table || echo "(failed to read app config)"
echo ""

echo "--- Recent Deployments (last 3) ---"
az webapp deployment list -n "$APP" -g "$RG" "${SUB_ARGS[@]}" \
    --query "[:3].{id:id, status:status, time:end_time}" -o table || echo "(failed to list deployments)"
echo ""

echo "--- App Settings (names only) ---"
az webapp config appsettings list -n "$APP" -g "$RG" "${SUB_ARGS[@]}" \
    --query "[].name" -o tsv || echo "(failed to list app settings)"
echo ""

echo "--- Custom Domains ---"
az webapp config hostname list -g "$RG" --webapp-name "$APP" "${SUB_ARGS[@]}" -o table || echo "(failed to list custom domains)"
echo ""

echo "=== Diagnostics collection complete for $APP ==="
