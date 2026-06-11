#!/usr/bin/env bash
# check-quota.sh
# Validates Azure quota capacity for a planned deployment.
#
# For each resource you intend to deploy, the script queries the quota limit and
# current usage (via the `az quota` CLI), then computes available capacity, the
# total after deployment (current usage + planned count), and a per-resource
# status. It prints a markdown checklist table plus an overall verdict so the
# result can be pasted directly into the deployment plan's Provisioning Limit
# Checklist.
#
# Scope: quota-API-SUPPORTED providers only (e.g. Microsoft.Compute,
# Microsoft.Network, Microsoft.App, Microsoft.Storage). For providers the quota
# API rejects with BadRequest (e.g. Microsoft.DocumentDB / Cosmos DB), the row is
# flagged as unsupported — follow the manual Resource Graph + service-docs
# fallback described in the skill.
#
# Usage:
#   ./check-quota.sh <region> <provider:quota-name:count> [more triples...] [--subscription <id>]
#
# count = number of units to ADD, expressed in the quota's own unit (vCPUs for
# VM-family quotas, e.g. 3 x Standard_D4s_v3 = 12; instance count for count-based
# quotas like StorageAccounts or ManagedEnvironmentCount).
#
# Examples:
#   ./check-quota.sh eastus Microsoft.Compute:standardDSv3Family:12
#   ./check-quota.sh eastus \
#       Microsoft.App:ManagedEnvironmentCount:1 \
#       Microsoft.Compute:standardDSv3Family:12 \
#       Microsoft.Storage:StorageAccounts:2 \
#       --subscription 00000000-0000-0000-0000-000000000000

set -euo pipefail

usage() {
    echo "Usage: $0 <region> <provider:quota-name:count> [more triples...] [--subscription <id>]" >&2
    exit 1
}

REGION="${1:-}"
[ -z "$REGION" ] && usage
shift

SUBSCRIPTION_ID=""
TRIPLES=()

while [ $# -gt 0 ]; do
    case "$1" in
        --subscription)
            SUBSCRIPTION_ID="${2:-}"
            shift 2
            ;;
        *)
            TRIPLES+=("$1")
            shift
            ;;
    esac
done

[ "${#TRIPLES[@]}" -eq 0 ] && usage

# Ensure the quota extension is installed
if ! az extension list --query "[?name=='quota'].name" -o tsv 2>/dev/null | grep -q quota; then
    echo "Installing quota extension..." >&2
    az extension add --name quota --yes 2>/dev/null
fi

# Resolve subscription
if [ -z "$SUBSCRIPTION_ID" ]; then
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
fi

echo "Validating quota capacity in region '$REGION' (subscription $SUBSCRIPTION_ID)" >&2
echo >&2

# Markdown table header
echo "| Provider | Quota | Region | Limit | Usage | Need | Total After | Available | Status |"
echo "|----------|-------|--------|-------|-------|------|-------------|-----------|--------|"

overall="ok"   # ok | near | insufficient

for triple in "${TRIPLES[@]}"; do
    provider="${triple%%:*}"
    rest="${triple#*:}"
    quota_name="${rest%%:*}"
    count="${rest##*:}"

    if [ "$provider" = "$triple" ] || [ "$quota_name" = "$rest" ] || [ -z "$quota_name" ] || [ -z "$count" ]; then
        echo "Invalid resource '$triple' — expected provider:quota-name:count" >&2
        usage
    fi

    scope="/subscriptions/$SUBSCRIPTION_ID/providers/$provider/locations/$REGION"

    # Query limit and usage. If the provider is not supported by the quota API,
    # the calls fail — flag the row and continue (supported-only scope).
    if ! limit=$(az quota show --resource-name "$quota_name" --scope "$scope" \
            --query "properties.limit.value" -o tsv 2>/dev/null) || [ -z "$limit" ]; then
        echo "| $provider | $quota_name | $REGION | — | — | $count | — | — | ⚠️ Unsupported — see docs |"
        [ "$overall" = "ok" ] && overall="near"
        continue
    fi

    usage_val=$(az quota usage show --resource-name "$quota_name" --scope "$scope" \
        --query "properties.usages.value" -o tsv 2>/dev/null || echo 0)
    [ -z "$usage_val" ] && usage_val=0

    available=$((limit - usage_val))
    total_after=$((usage_val + count))

    if [ "$total_after" -gt "$limit" ]; then
        status="❌ Insufficient"
        overall="insufficient"
    elif [ $((total_after * 100)) -gt $((limit * 80)) ]; then
        status="⚠️ Near limit"
        [ "$overall" = "ok" ] && overall="near"
    else
        status="✅ Within limit"
    fi

    echo "| $provider | $quota_name | $REGION | $limit | $usage_val | $count | $total_after | $available | $status |"
done

echo
case "$overall" in
    insufficient)
        echo "Overall: ❌ Insufficient capacity — request a quota increase or choose a different region."
        ;;
    near)
        echo "Overall: ⚠️ Near limit or unsupported rows present — review flagged resources before proceeding."
        ;;
    *)
        echo "Overall: ✅ All resources within limits."
        ;;
esac
