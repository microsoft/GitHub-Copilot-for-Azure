#!/bin/bash
# Validates a DCR JSON file for common structural issues before deployment.
# Full parity with validate-dcr.ps1.
# Usage: ./validate-dcr.sh <dcr-file-path>
# Requires: jq

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Navigate to properties (support both wrapped and unwrapped formats)
HAS_PROPS=$(jq 'has("properties")' "$DcrFilePath")
if [ "$HAS_PROPS" = "true" ]; then
    PROPS='.properties'
else
    PROPS='.'
fi

KIND=$(jq -r '.kind // empty' "$DcrFilePath")
IS_DIRECT=false
[ "$KIND" = "Direct" ] && IS_DIRECT=true

# Check required sections
HAS_DATASOURCES=$(jq "${PROPS}.dataSources != null" "$DcrFilePath")
HAS_DESTINATIONS=$(jq "${PROPS}.destinations != null" "$DcrFilePath")
HAS_DATAFLOWS=$(jq "${PROPS}.dataFlows != null" "$DcrFilePath")

if [ "$IS_DIRECT" = false ] && [ "$HAS_DATASOURCES" = "false" ]; then
    ERRORS+=("Missing 'dataSources' section (required for non-Direct DCRs)")
fi
if [ "$IS_DIRECT" = true ] && [ "$HAS_DATASOURCES" = "true" ]; then
    WARNINGS+=("Direct DCR should not have a 'dataSources' section")
fi
if [ "$HAS_DESTINATIONS" = "false" ]; then
    ERRORS+=("Missing 'destinations' section")
fi
if [ "$HAS_DATAFLOWS" = "false" ]; then
    ERRORS+=("Missing 'dataFlows' section")
fi

# Collect declared custom streams
DECLARED_STREAMS=$(jq -r "${PROPS}.streamDeclarations // {} | keys[]" "$DcrFilePath" 2>/dev/null)

# Collect named transformations
NAMED_TRANSFORMS=$(jq -r "[${PROPS}.transformations // [] | .[].name // empty] | .[]" "$DcrFilePath" 2>/dev/null)

# Collect destination names
DEST_NAMES=$(jq -r "[${PROPS}.destinations // {} | to_entries[] | .value | if type == \"array\" then .[].name else .name // empty end] | .[]" "$DcrFilePath" 2>/dev/null)

# Collect transform-derived streams (data sources with a transform reference)
TRANSFORM_DERIVED_STREAMS=$(jq -r "[${PROPS}.dataSources // {} | to_entries[] | .value[] | select(.transform != null) | .streams // [] | .[]] | .[]" "$DcrFilePath" 2>/dev/null)

# ── Validate data sources ──
if [ "$HAS_DATASOURCES" = "true" ]; then
    DS_JSON=$(jq -c "${PROPS}.dataSources | to_entries[]" "$DcrFilePath" 2>/dev/null)
    while IFS= read -r ds_entry; do
        [ -z "$ds_entry" ] && continue
        ds_type=$(echo "$ds_entry" | jq -r '.key')
        ds_items=$(echo "$ds_entry" | jq -c '.value | if type == "array" then .[] else . end' 2>/dev/null)
        while IFS= read -r ds; do
            [ -z "$ds" ] && continue
            ds_name=$(echo "$ds" | jq -r '.name // "unnamed"')
            ds_transform=$(echo "$ds" | jq -r '.transform // empty')
            # Check transform references
            if [ -n "$ds_transform" ]; then
                if ! echo "$NAMED_TRANSFORMS" | grep -qx "$ds_transform"; then
                    ERRORS+=("DataSource '$ds_name' references transform '$ds_transform' which is not defined in transformations")
                fi
            fi
            # Check custom stream declarations
            ds_streams=$(echo "$ds" | jq -r '.streams // [] | .[]')
            for stream in $ds_streams; do
                if [[ "$stream" == Custom-* ]] && ! echo "$DECLARED_STREAMS" | grep -qx "$stream"; then
                    if [ -z "$ds_transform" ]; then
                        ERRORS+=("DataSource '$ds_name' uses stream '$stream' not declared in streamDeclarations")
                    fi
                fi
            done
        done <<< "$ds_items"
    done <<< "$DS_JSON"
fi

# ── Load supported tables ──
SUPPORTED_TABLES_FILE="$SCRIPT_DIR/../references/supported-tables.json"
if [ -f "$SUPPORTED_TABLES_FILE" ]; then
    SUPPORTED_TABLES=$(jq -r '.[]' "$SUPPORTED_TABLES_FILE" 2>/dev/null)
else
    WARNINGS+=("Could not find supported-tables.json. Custom-stream-to-standard-table routing validation skipped.")
    SUPPORTED_TABLES=""
fi

# ── Validate data flows ──
FLOW_COUNT=$(jq "${PROPS}.dataFlows // [] | length" "$DcrFilePath")
for i in $(seq 0 $((FLOW_COUNT - 1))); do
    HAS_TRANSFORM=$(jq -r "${PROPS}.dataFlows[$i].transform // empty" "$DcrFilePath")
    HAS_TRANSFORMKQL=$(jq -r "${PROPS}.dataFlows[$i].transformKql // empty" "$DcrFilePath")

    # Mutual exclusivity
    if [ -n "$HAS_TRANSFORM" ] && [ -n "$HAS_TRANSFORMKQL" ]; then
        ERRORS+=("DataFlow has both 'transform' and 'transformKql' (mutually exclusive)")
    fi

    # Transform references
    if [ -n "$HAS_TRANSFORM" ]; then
        if ! echo "$NAMED_TRANSFORMS" | grep -qx "$HAS_TRANSFORM"; then
            ERRORS+=("DataFlow references transform '$HAS_TRANSFORM' which is not defined in transformations")
        fi
    fi

    # Destination references
    FLOW_DESTS=$(jq -r "${PROPS}.dataFlows[$i].destinations // [] | .[]" "$DcrFilePath")
    for dest in $FLOW_DESTS; do
        if ! echo "$DEST_NAMES" | grep -qx "$dest"; then
            ERRORS+=("DataFlow references destination '$dest' which is not defined in destinations")
        fi
    done

    # Stream references
    FLOW_STREAMS=$(jq -r "${PROPS}.dataFlows[$i].streams // [] | .[]" "$DcrFilePath")
    for stream in $FLOW_STREAMS; do
        if [[ "$stream" == Custom-* ]] && ! echo "$DECLARED_STREAMS" | grep -qx "$stream" && ! echo "$TRANSFORM_DERIVED_STREAMS" | grep -qx "$stream"; then
            ERRORS+=("DataFlow uses stream '$stream' not declared in streamDeclarations")
        fi
    done

    # Routing rules
    OUTPUT_STREAM=$(jq -r "${PROPS}.dataFlows[$i].outputStream // empty" "$DcrFilePath")
    if [ -n "$OUTPUT_STREAM" ]; then
        INPUT_HAS_STANDARD=false
        INPUT_HAS_CUSTOM=false
        for stream in $FLOW_STREAMS; do
            [[ "$stream" == Microsoft-* ]] && INPUT_HAS_STANDARD=true
            [[ "$stream" == Custom-* ]] && INPUT_HAS_CUSTOM=true
        done

        # Standard stream to custom table requires transformKql or transform
        if [ "$INPUT_HAS_STANDARD" = true ] && [[ "$OUTPUT_STREAM" == Custom-* ]] && [ -z "$HAS_TRANSFORMKQL" ] && [ -z "$HAS_TRANSFORM" ]; then
            ERRORS+=("DataFlow routes standard stream to custom table '$OUTPUT_STREAM'. Add transformKql, a named transform, or use a custom stream.")
        fi

        # Custom stream to standard table must be on supported list
        if [ "$INPUT_HAS_CUSTOM" = true ] && [[ "$OUTPUT_STREAM" == Microsoft-* ]] && [ -n "$SUPPORTED_TABLES" ]; then
            TABLE_NAME="${OUTPUT_STREAM#Microsoft-}"
            if ! echo "$SUPPORTED_TABLES" | grep -qx "$TABLE_NAME"; then
                ERRORS+=("DataFlow routes custom stream to standard table '$TABLE_NAME' which is not on the supported tables list.")
            fi
        fi
    fi

    # transformKql character limit
    if [ -n "$HAS_TRANSFORMKQL" ]; then
        KQL_LEN=${#HAS_TRANSFORMKQL}
        if [ "$KQL_LEN" -gt 15360 ]; then
            ERRORS+=("DataFlow transformKql is $KQL_LEN chars (limit: 15,360)")
        fi
    fi
done

# ── Validate transformations ──
TRANSFORM_COUNT=$(jq "${PROPS}.transformations // [] | length" "$DcrFilePath")
for i in $(seq 0 $((TRANSFORM_COUNT - 1))); do
    T_NAME=$(jq -r "${PROPS}.transformations[$i].name // empty" "$DcrFilePath")
    T_HAS_HEADER=$(jq "${PROPS}.transformations[$i].headerProcessor != null" "$DcrFilePath")
    [ -z "$T_NAME" ] && ERRORS+=("Transformation missing 'name'")
    [ "$T_HAS_HEADER" = "false" ] && ERRORS+=("Transformation '$T_NAME' missing 'headerProcessor'")
done

# ── Limits validation ──

# Data source count (max 10)
DS_COUNT=$(jq "[${PROPS}.dataSources // {} | to_entries[] | .value | if type == \"array\" then length else 1 end] | add // 0" "$DcrFilePath")
if [ "$DS_COUNT" -gt 10 ]; then
    ERRORS+=("DCR has $DS_COUNT data sources (limit: 10)")
fi

# Data flow count (max 10)
if [ "$FLOW_COUNT" -gt 10 ]; then
    ERRORS+=("DCR has $FLOW_COUNT data flows (limit: 10)")
fi

# Total stream count (max 20)
CUSTOM_STREAM_COUNT=$(echo "$DECLARED_STREAMS" | grep -c '.' 2>/dev/null || echo 0)
MS_STREAM_COUNT=$(jq "[${PROPS}.dataFlows // [] | .[].streams // [] | .[] | select(startswith(\"Microsoft-\"))] | unique | length" "$DcrFilePath")
TOTAL_STREAMS=$((CUSTOM_STREAM_COUNT + MS_STREAM_COUNT))
if [ "$TOTAL_STREAMS" -gt 20 ]; then
    ERRORS+=("DCR has $TOTAL_STREAMS streams (limit: 20)")
fi

# LA destination count (max 10)
LA_DEST_COUNT=$(jq "${PROPS}.destinations.logAnalytics // [] | length" "$DcrFilePath")
if [ "$LA_DEST_COUNT" -gt 10 ]; then
    ERRORS+=("DCR has $LA_DEST_COUNT Log Analytics destinations (limit: 10)")
fi

# Performance counter specifiers (max 100 per data source)
if [ "$HAS_DATASOURCES" = "true" ]; then
    PC_COUNT=$(jq "${PROPS}.dataSources.performanceCounters // [] | length" "$DcrFilePath")
    for i in $(seq 0 $((PC_COUNT - 1))); do
        PC_NAME=$(jq -r "${PROPS}.dataSources.performanceCounters[$i].name // \"unnamed\"" "$DcrFilePath")
        SPEC_COUNT=$(jq "${PROPS}.dataSources.performanceCounters[$i].counterSpecifiers // [] | length" "$DcrFilePath")
        if [ "$SPEC_COUNT" -gt 100 ]; then
            ERRORS+=("Performance counter '$PC_NAME' has $SPEC_COUNT specifiers (limit: 100)")
        fi
    done

    # Syslog facility names (max 20 per data source)
    SL_COUNT=$(jq "${PROPS}.dataSources.syslog // [] | length" "$DcrFilePath")
    for i in $(seq 0 $((SL_COUNT - 1))); do
        SL_NAME=$(jq -r "${PROPS}.dataSources.syslog[$i].name // \"unnamed\"" "$DcrFilePath")
        FAC_COUNT=$(jq "${PROPS}.dataSources.syslog[$i].facilityNames // [] | length" "$DcrFilePath")
        if [ "$FAC_COUNT" -gt 20 ]; then
            ERRORS+=("Syslog '$SL_NAME' has $FAC_COUNT facility names (limit: 20)")
        fi
    done

    # Windows Event Log xPathQueries (max 100 per data source)
    WEL_COUNT=$(jq "${PROPS}.dataSources.windowsEventLogs // [] | length" "$DcrFilePath")
    for i in $(seq 0 $((WEL_COUNT - 1))); do
        WEL_NAME=$(jq -r "${PROPS}.dataSources.windowsEventLogs[$i].name // \"unnamed\"" "$DcrFilePath")
        XP_COUNT=$(jq "${PROPS}.dataSources.windowsEventLogs[$i].xPathQueries // [] | length" "$DcrFilePath")
        if [ "$XP_COUNT" -gt 100 ]; then
            ERRORS+=("WindowsEventLog '$WEL_NAME' has $XP_COUNT xPathQueries (limit: 100)")
        fi
    done
fi

# Direct DCR name validation (3-30 chars, DNS-safe)
if [ "$IS_DIRECT" = true ]; then
    DCR_NAME=$(jq -r '.name // empty' "$DcrFilePath")
    if [ -n "$DCR_NAME" ]; then
        NAME_LEN=${#DCR_NAME}
        if [ "$NAME_LEN" -lt 3 ] || [ "$NAME_LEN" -gt 30 ]; then
            ERRORS+=("Direct DCR name '$DCR_NAME' must be 3-30 characters (current: $NAME_LEN)")
        fi
        if ! [[ "$DCR_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$ ]]; then
            ERRORS+=("Direct DCR name '$DCR_NAME' must be alphanumeric + hyphens only (DNS-safe)")
        fi
    fi
fi

# ── Stream declaration column validation ──
for STREAM_NAME in $DECLARED_STREAMS; do
    # Stream naming
    if [[ "$STREAM_NAME" == Microsoft-* ]]; then
        ERRORS+=("Stream '$STREAM_NAME' in streamDeclarations must not start with 'Microsoft-'. Standard streams have implicit schemas and should not be declared.")
    elif [[ "$STREAM_NAME" != Custom-* ]]; then
        ERRORS+=("Stream '$STREAM_NAME' must start with 'Custom-' (standard streams use 'Microsoft-' prefix and should not appear in streamDeclarations)")
    fi

    # Column validation
    COL_COUNT=$(jq "${PROPS}.streamDeclarations[\"$STREAM_NAME\"].columns // [] | length" "$DcrFilePath")
    if [ "$COL_COUNT" -gt 1000 ]; then
        ERRORS+=("Stream '$STREAM_NAME' has $COL_COUNT columns (limit: 1,000)")
    fi
    for c in $(seq 0 $((COL_COUNT - 1))); do
        COL_NAME=$(jq -r "${PROPS}.streamDeclarations[\"$STREAM_NAME\"].columns[$c].name" "$DcrFilePath")
        COL_TYPE=$(jq -r "${PROPS}.streamDeclarations[\"$STREAM_NAME\"].columns[$c].type // empty" "$DcrFilePath")
        if [ ${#COL_NAME} -gt 60 ]; then
            ERRORS+=("Stream '$STREAM_NAME' column '$COL_NAME' exceeds 60 char name limit")
        fi
        if ! [[ "$COL_NAME" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]]; then
            ERRORS+=("Stream '$STREAM_NAME' column '$COL_NAME' has invalid name (must start with letter, only alphanumeric + underscore)")
        fi
        if [ -n "$COL_TYPE" ]; then
            case "$COL_TYPE" in
                string|int|long|real|boolean|dynamic|datetime) ;;
                *) ERRORS+=("Stream '$STREAM_NAME' column '$COL_NAME' has unsupported type '$COL_TYPE' (use: string, int, long, real, boolean, dynamic, datetime)") ;;
            esac
        fi
    done
done

# ── Report ──
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
