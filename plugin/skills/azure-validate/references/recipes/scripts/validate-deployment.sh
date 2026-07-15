#!/usr/bin/env bash
# validate-deployment.sh
# Runs the standard Azure CLI pre-deployment validation sequence for a Bicep
# template and reports PASS/FAIL for each step. Shared by the AZCLI and Bicep
# validation recipes.
#
# Steps (in order):
#   1. az version         - Azure CLI is installed
#   2. az account show    - authenticated to Azure
#   3. az bicep build     - template compiles cleanly
#   4. az deployment ... validate  - template validates against the target scope
#   5. az deployment ... what-if   - preview changes (with a Create/Modify/Delete summary)
#
# Usage:
#   ./validate-deployment.sh --scope sub   --location <location>       [options]
#   ./validate-deployment.sh --scope group --resource-group <rg-name>  [options]
#
# Options:
#   --scope <sub|group>       Deployment scope (required)
#   --location <location>     Location (required when --scope sub)
#   --resource-group <name>   Resource group (required when --scope group)
#   --template <path>         Bicep template (default: ./infra/main.bicep)
#   --parameters <path>       Parameters file (default: ./infra/main.parameters.json;
#                             skipped automatically if the file does not exist)
#   --subscription <id>       Subscription to target (optional)
#
# Examples:
#   ./validate-deployment.sh --scope sub --location eastus
#   ./validate-deployment.sh --scope group --resource-group my-rg \
#       --template ./infra/main.bicep --parameters ./infra/main.parameters.json
#
# Exit code: 0 if every step passes, 1 otherwise.

set -uo pipefail

SCOPE=""
LOCATION=""
RESOURCE_GROUP=""
TEMPLATE="./infra/main.bicep"
PARAMETERS="./infra/main.parameters.json"
SUBSCRIPTION=""

while [ $# -gt 0 ]; do
    case "$1" in
        --scope)          SCOPE="${2:-}"; shift 2 ;;
        --location)       LOCATION="${2:-}"; shift 2 ;;
        --resource-group) RESOURCE_GROUP="${2:-}"; shift 2 ;;
        --template)       TEMPLATE="${2:-}"; shift 2 ;;
        --parameters)     PARAMETERS="${2:-}"; shift 2 ;;
        --subscription)   SUBSCRIPTION="${2:-}"; shift 2 ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 2 ;;
    esac
done

# Validate arguments
if [ "$SCOPE" != "sub" ] && [ "$SCOPE" != "group" ]; then
    echo "ERROR: --scope must be 'sub' or 'group'." >&2
    exit 2
fi
if [ "$SCOPE" = "sub" ] && [ -z "$LOCATION" ]; then
    echo "ERROR: --location is required when --scope is 'sub'." >&2
    exit 2
fi
if [ "$SCOPE" = "group" ] && [ -z "$RESOURCE_GROUP" ]; then
    echo "ERROR: --resource-group is required when --scope is 'group'." >&2
    exit 2
fi

# Build shared argument arrays
SUB_ARGS=()
[ -n "$SUBSCRIPTION" ] && SUB_ARGS=(--subscription "$SUBSCRIPTION")

PARAM_ARGS=()
if [ -f "$PARAMETERS" ]; then
    PARAM_ARGS=(--parameters "$PARAMETERS")
else
    echo "NOTE: parameters file '$PARAMETERS' not found; validating without --parameters."
fi

if [ "$SCOPE" = "sub" ]; then
    SCOPE_TARGET_ARGS=(--location "$LOCATION")
    SCOPE_DESC="subscription (location: $LOCATION)"
else
    SCOPE_TARGET_ARGS=(--resource-group "$RESOURCE_GROUP")
    SCOPE_DESC="resource group '$RESOURCE_GROUP'"
fi

# Track results
declare -a STEP_NAMES=()
declare -a STEP_RESULTS=()
OVERALL=0

record() {
    STEP_NAMES+=("$1")
    STEP_RESULTS+=("$2")
    [ "$2" = "PASS" ] || OVERALL=1
}

echo "=== Azure deployment validation ==="
echo "Template:   $TEMPLATE"
echo "Scope:      $SCOPE_DESC"
echo ""

# Step 1: Azure CLI installed
echo "--- Step 1: Azure CLI installed (az version) ---"
if az version >/dev/null 2>&1; then
    echo "PASS: Azure CLI is installed."
    record "Azure CLI installed" PASS
else
    echo "FAIL: Azure CLI not found. Install it, then re-run."
    record "Azure CLI installed" FAIL
    # Nothing else can run without the CLI.
    printf '\n=== Summary ===\n'
    printf '%-28s %s\n' "${STEP_NAMES[0]}" "${STEP_RESULTS[0]}"
    echo "OVERALL: FAIL"
    exit 1
fi
echo ""

# Step 2: Authenticated
echo "--- Step 2: Authenticated (az account show) ---"
ACCOUNT_JSON=$(az account show "${SUB_ARGS[@]}" -o json 2>/dev/null)
if [ -n "$ACCOUNT_JSON" ]; then
    ACCOUNT_NAME=$(echo "$ACCOUNT_JSON" | grep -o '"name"[^,]*' | head -1 | sed 's/.*: *"\(.*\)"/\1/')
    echo "PASS: Authenticated (subscription: ${ACCOUNT_NAME:-unknown})."
    record "Authenticated" PASS
else
    echo "FAIL: Not logged in. Run 'az login' (and 'az account set --subscription <id>')."
    record "Authenticated" FAIL
fi
echo ""

# Step 3: Bicep compilation
echo "--- Step 3: Bicep compilation (az bicep build) ---"
BUILD_OUTPUT=$(az bicep build --file "$TEMPLATE" 2>&1)
BUILD_RC=$?
if [ $BUILD_RC -eq 0 ]; then
    echo "PASS: Template compiles cleanly."
    record "Bicep compilation" PASS
else
    echo "FAIL: Bicep compilation errors:"
    echo "$BUILD_OUTPUT"
    record "Bicep compilation" FAIL
fi
echo ""

# Step 4: Template validation
echo "--- Step 4: Template validation (az deployment $SCOPE validate) ---"
VALIDATE_OUTPUT=$(az deployment "$SCOPE" validate "${SCOPE_TARGET_ARGS[@]}" \
    --template-file "$TEMPLATE" \
    "${PARAM_ARGS[@]}" "${SUB_ARGS[@]}" 2>&1)
VALIDATE_RC=$?
if [ $VALIDATE_RC -eq 0 ]; then
    echo "PASS: Template validated against the target scope."
    record "Template validation" PASS
else
    echo "FAIL: Template validation errors:"
    echo "$VALIDATE_OUTPUT"
    record "Template validation" FAIL
fi
echo ""

# Step 5: What-if preview
echo "--- Step 5: What-if preview (az deployment $SCOPE what-if) ---"
WHATIF_OUTPUT=$(az deployment "$SCOPE" what-if "${SCOPE_TARGET_ARGS[@]}" \
    --template-file "$TEMPLATE" \
    "${PARAM_ARGS[@]}" "${SUB_ARGS[@]}" 2>&1)
WHATIF_RC=$?
if [ $WHATIF_RC -eq 0 ]; then
    CREATE_COUNT=$(echo "$WHATIF_OUTPUT" | grep -c '^[[:space:]]*+ ')
    MODIFY_COUNT=$(echo "$WHATIF_OUTPUT" | grep -c '^[[:space:]]*~ ')
    DELETE_COUNT=$(echo "$WHATIF_OUTPUT" | grep -c '^[[:space:]]*- ')
    echo "PASS: What-if completed. Changes -> Create: $CREATE_COUNT, Modify: $MODIFY_COUNT, Delete: $DELETE_COUNT"
    record "What-if preview" PASS
else
    echo "FAIL: What-if errors:"
    echo "$WHATIF_OUTPUT"
    record "What-if preview" FAIL
fi
echo ""

# Summary
echo "=== Summary ==="
for i in "${!STEP_NAMES[@]}"; do
    printf '%-28s %s\n' "${STEP_NAMES[$i]}" "${STEP_RESULTS[$i]}"
done
if [ $OVERALL -eq 0 ]; then
    echo "OVERALL: PASS"
else
    echo "OVERALL: FAIL"
fi
exit $OVERALL
