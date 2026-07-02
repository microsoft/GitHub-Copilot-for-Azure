#!/bin/bash
# Validates a DCR JSON file for common structural issues before deployment.
# Usage: ./validate-dcr.sh <dcr-file-path>
# Requires: jq

DcrFilePath="${1}"

if [ -z "$DcrFilePath" ]; then
    echo "ERROR: DcrFilePath is required." >&2
    echo "Usage: ./validate-dcr.sh <dcr-file-path>" >&2
    exit 1
fi

if [ ! -f "$DcrFilePath" ]; then
    echo "ERROR: File not found: $DcrFilePath" >&2
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "ERROR: jq is required but not installed." >&2
    exit 1
fi

# Validate JSON
if ! jq empty "$DcrFilePath" 2>/dev/null; then
    echo "ERROR: Invalid JSON in $DcrFilePath" >&2
    exit 1
fi

ERRORS=()
WARNINGS=()

# Read DCR
KIND=$(jq -r '.kind // empty' "$DcrFilePath")
IS_DIRECT=false
[ "$KIND" = "Direct" ] && IS_DIRECT=true

# Check required sections
HAS_DATASOURCES=$(jq 'if .properties.dataSources then "yes" else "no" end' -r "$DcrFilePath")
HAS_DESTINATIONS=$(jq 'if .properties.destinations then "yes" else "no" end' -r "$DcrFilePath")
HAS_DATAFLOWS=$(jq 'if .properties.dataFlows then "yes" else "no" end' -r "$DcrFilePath")

if [ "$IS_DIRECT" = false ] && [ "$HAS_DATASOURCES" = "no" ]; then
    ERRORS+=("Missing 'dataSources' section (required for non-Direct DCRs)")
fi
if [ "$IS_DIRECT" = true ] && [ "$HAS_DATASOURCES" = "yes" ]; then
    WARNINGS+=("Direct DCR should not have a 'dataSources' section")
fi
if [ "$HAS_DESTINATIONS" = "no" ]; then
    ERRORS+=("Missing 'destinations' section")
fi
if [ "$HAS_DATAFLOWS" = "no" ]; then
    ERRORS+=("Missing 'dataFlows' section")
fi

# Stream declaration validation
STREAM_NAMES=$(jq -r '.properties.streamDeclarations // {} | keys[]' "$DcrFilePath" 2>/dev/null)
for STREAM in $STREAM_NAMES; do
    if [[ "$STREAM" == Microsoft-* ]]; then
        ERRORS+=("Stream '$STREAM' in streamDeclarations must not start with 'Microsoft-'. Standard streams have implicit schemas and should not be declared.")
    elif [[ "$STREAM" != Custom-* ]]; then
        ERRORS+=("Stream '$STREAM' must start with 'Custom-'")
    fi
done

# DataFlow destination validation
DEST_NAMES=$(jq -r '[.properties.destinations // {} | to_entries[] | .value[] | .name // empty] | .[]' "$DcrFilePath" 2>/dev/null)
FLOW_COUNT=$(jq '.properties.dataFlows // [] | length' "$DcrFilePath")
for i in $(seq 0 $((FLOW_COUNT - 1))); do
    FLOW_DESTS=$(jq -r ".properties.dataFlows[$i].destinations // [] | .[]" "$DcrFilePath")
    for DEST in $FLOW_DESTS; do
        if ! echo "$DEST_NAMES" | grep -qx "$DEST"; then
            ERRORS+=("DataFlow references destination '$DEST' which is not defined in destinations")
        fi
    done
    # Check mutual exclusivity
    HAS_TRANSFORM=$(jq -r ".properties.dataFlows[$i].transform // empty" "$DcrFilePath")
    HAS_TRANSFORMKQL=$(jq -r ".properties.dataFlows[$i].transformKql // empty" "$DcrFilePath")
    if [ -n "$HAS_TRANSFORM" ] && [ -n "$HAS_TRANSFORMKQL" ]; then
        ERRORS+=("DataFlow has both 'transform' and 'transformKql' (mutually exclusive)")
    fi
done

# Limits
DS_COUNT=$(jq '[.properties.dataSources // {} | to_entries[] | .value | if type == "array" then length else 1 end] | add // 0' "$DcrFilePath")
if [ "$DS_COUNT" -gt 10 ]; then
    ERRORS+=("DCR has $DS_COUNT data sources (limit: 10)")
fi
if [ "$FLOW_COUNT" -gt 10 ]; then
    ERRORS+=("DCR has $FLOW_COUNT data flows (limit: 10)")
fi

# Report
if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
    echo "Validation PASSED. No issues found."
    exit 0
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "ERRORS (${#ERRORS[@]}):"
    for err in "${ERRORS[@]}"; do
        echo "  - $err"
    done
fi
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "WARNINGS (${#WARNINGS[@]}):"
    for warn in "${WARNINGS[@]}"; do
        echo "  - $warn"
    done
fi

[ ${#ERRORS[@]} -gt 0 ] && exit 1
exit 0
