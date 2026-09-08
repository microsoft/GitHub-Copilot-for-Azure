#!/usr/bin/env bash
# Checks Azure quota requirements.
# Exit codes: 0 = all requirements pass or are near limit; 1 = insufficient
# capacity or an operational error; 2 = invalid arguments.

set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./check-quota.sh <provider> <region> [quota-resource-name] [subscription-id]
  ./check-quota.sh --region <region> --requirements-file <json-file> [--subscription-id <id>]
  ./check-quota.sh --help

Legacy mode checks every quota for a provider, or one quota when its resource
name is supplied. Requested count is zero in legacy mode.

Batch mode reads a UTF-8 JSON array. Each object requires provider,
resourceName, and requested. Optional resourceType and documentedLimit must be
supplied together. They are used only when Azure Quota returns BadRequest, in
which case current usage is counted with Azure Resource Graph.

  [{"provider":"Microsoft.Compute","resourceName":"standardDSv3Family",
    "requested":2}]

Status is INSUFFICIENT when projected usage exceeds the limit, NEAR-LIMIT when
projected usage is at least 80% of a positive limit, and PASS otherwise.

Examples:
  ./check-quota.sh Microsoft.Compute eastus standardDSv3Family
  ./check-quota.sh --region eastus --requirements-file requirements.json
EOF
}

invalid() {
    echo "Error: $*" >&2
    usage >&2
    exit 2
}

operational_error() {
    echo "Error: $*" >&2
    exit 1
}

is_nonnegative_integer() {
    case "$1" in
        ""|*[!0-9]*) return 1 ;;
        *) return 0 ;;
    esac
}

is_bad_request() {
    if grep -Fq "BadRequest" "$ERR_FILE"; then
        return 0
    else
        grep_status=$?
        if [ "$grep_status" -eq 1 ]; then
            return 1
        fi
        operational_error "could not read Azure CLI error output."
    fi
}

run_az() {
    if az "$@" >"$OUT_FILE" 2>"$ERR_FILE"; then
        return 0
    else
        az_status=$?
        return "$az_status"
    fi
}

error_detail() {
    if [ -s "$ERR_FILE" ]; then
        sed -n '1p' "$ERR_FILE"
    else
        printf '%s' "Azure CLI returned no error details"
    fi
}

ensure_extension() {
    extension_name=$1
    if ! run_az extension list --query "[?name=='$extension_name'].name" -o tsv; then
        operational_error "could not list Azure CLI extensions: $(error_detail)"
    fi
    extension_value=""
    if IFS= read -r extension_value <"$OUT_FILE"; then
        extension_value=${extension_value%$'\r'}
    elif [ -s "$OUT_FILE" ]; then
        operational_error "could not read Azure CLI extension output."
    fi
    if [ -z "$extension_value" ]; then
        echo "Installing Azure CLI extension '$extension_name'..." >&2
        if ! run_az extension add --name "$extension_name" --yes; then
            operational_error "could not install '$extension_name': $(error_detail)"
        fi
    fi
}

validate_provider_and_region() {
    case "$1" in
        ""|*[!A-Za-z0-9._-]*) invalid "invalid resource provider '$1'." ;;
    esac
    case "$REGION" in
        ""|*[!A-Za-z0-9-]*) invalid "invalid region '$REGION'." ;;
    esac
}

update_overall() {
    case "$1" in
        INSUFFICIENT) OVERALL="INSUFFICIENT" ;;
        NEAR-LIMIT)
            if [ "$OVERALL" = "PASS" ]; then
                OVERALL="NEAR-LIMIT"
            fi
            ;;
    esac
}

emit_result() {
    provider=$1
    quota_name=$2
    requested=$3
    current=$4
    limit=$5
    source=$6

    projected=$((current + requested))
    available=$((limit - current))
    if [ "$projected" -gt "$limit" ]; then
        status="INSUFFICIENT"
    elif [ "$limit" -gt 0 ] && [ $((projected * 100)) -ge $((limit * 80)) ]; then
        status="NEAR-LIMIT"
    else
        status="PASS"
    fi
    update_overall "$status"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$provider" "$quota_name" "$REGION" "$requested" "$current" "$limit" \
        "$projected" "$available" "$status" "$source"
}

resource_graph_fallback() {
    provider=$1
    quota_name=$2
    requested=$3
    arm_type=$4
    documented_limit=$5

    if [ -z "$arm_type" ] || [ -z "$documented_limit" ]; then
        operational_error "Azure Quota returned BadRequest for '$quota_name'; ARM resource type and documented limit are required for fallback."
    fi
    case "$arm_type" in
        *[!A-Za-z0-9._/-]*) invalid "invalid ARM resource type '$arm_type'." ;;
    esac
    if ! is_nonnegative_integer "$documented_limit"; then
        invalid "documented limit for '$quota_name' must be a non-negative integer."
    fi

    ensure_extension "resource-graph"
    graph_query="Resources | where type =~ '$arm_type' and location =~ '$REGION' | summarize count()"
    if ! run_az graph query --subscriptions "$SUBSCRIPTION_ID" -q "$graph_query" \
        --query "data[0].count_" -o tsv; then
        operational_error "Resource Graph count failed for '$arm_type': $(error_detail)"
    fi
    current=""
    if ! IFS= read -r current <"$OUT_FILE"; then
        operational_error "Resource Graph returned no count for '$arm_type'."
    fi
    current=${current%$'\r'}
    if ! is_nonnegative_integer "$current"; then
        operational_error "Resource Graph returned a non-integer count for '$arm_type'."
    fi
    emit_result "$provider" "$quota_name" "$requested" "$current" "$documented_limit" "ResourceGraph"
}

check_requirement() {
    provider=$1
    quota_name=$2
    requested=$3
    arm_type=$4
    documented_limit=$5

    validate_provider_and_region "$provider"
    [ -n "$quota_name" ] || invalid "quota resource name cannot be empty."
    if ! is_nonnegative_integer "$requested"; then
        invalid "requested count for '$quota_name' must be a non-negative integer."
    fi
    if { [ -n "$arm_type" ] && [ -z "$documented_limit" ]; } ||
       { [ -z "$arm_type" ] && [ -n "$documented_limit" ]; }; then
        invalid "ARM resource type and documented limit must be supplied together for '$quota_name'."
    fi

    scope="/subscriptions/$SUBSCRIPTION_ID/providers/$provider/locations/$REGION"
    if ! run_az quota list --scope "$scope" --query "[].name" -o tsv; then
        if is_bad_request; then
            resource_graph_fallback "$provider" "$quota_name" "$requested" "$arm_type" "$documented_limit"
            return
        fi
        operational_error "quota discovery failed for '$provider': $(error_detail)"
    fi

    discovered=""
    while IFS= read -r discovered_name || [ -n "$discovered_name" ]; do
        discovered_name=${discovered_name%$'\r'}
        if [ "$discovered_name" = "$quota_name" ]; then
            discovered=$discovered_name
            break
        fi
    done <"$OUT_FILE"
    [ -n "$discovered" ] || operational_error "quota resource '$quota_name' was not returned by quota discovery for '$provider'."

    if ! run_az quota show --resource-name "$discovered" --scope "$scope" \
        --query "properties.limit.value" -o tsv; then
        if is_bad_request; then
            resource_graph_fallback "$provider" "$quota_name" "$requested" "$arm_type" "$documented_limit"
            return
        fi
        operational_error "quota limit query failed for '$quota_name': $(error_detail)"
    fi
    limit=""
    if ! IFS= read -r limit <"$OUT_FILE"; then
        operational_error "quota limit query returned no value for '$quota_name'."
    fi
    limit=${limit%$'\r'}

    if ! run_az quota usage show --resource-name "$discovered" --scope "$scope" \
        --query "properties.usages.value" -o tsv; then
        if is_bad_request; then
            resource_graph_fallback "$provider" "$quota_name" "$requested" "$arm_type" "$documented_limit"
            return
        fi
        operational_error "quota usage query failed for '$quota_name': $(error_detail)"
    fi
    current=""
    if ! IFS= read -r current <"$OUT_FILE"; then
        operational_error "quota usage query returned no value for '$quota_name'."
    fi
    current=${current%$'\r'}

    is_nonnegative_integer "$limit" || operational_error "quota limit for '$quota_name' is not a non-negative integer."
    is_nonnegative_integer "$current" || operational_error "quota usage for '$quota_name' is not a non-negative integer."
    emit_result "$provider" "$quota_name" "$requested" "$current" "$limit" "QuotaAPI"
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    usage
    exit 0
fi

REGION=""
SUBSCRIPTION_ID=""
REQUIREMENTS_FILE=""
LEGACY_PROVIDER=""
LEGACY_RESOURCE=""

if [ "${1:-}" = "--region" ] || [ "${1:-}" = "--requirements-file" ] ||
   [ "${1:-}" = "--subscription-id" ] || [ "${1:-}" = "--subscription" ]; then
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --region|--requirements-file|--subscription-id|--subscription)
                [ "$#" -ge 2 ] || invalid "option '$1' requires a value."
                option=$1
                value=$2
                [ -n "$value" ] || invalid "option '$option' requires a non-empty value."
                case "$option" in
                    --region) REGION=$value ;;
                    --requirements-file) REQUIREMENTS_FILE=$value ;;
                    --subscription-id|--subscription) SUBSCRIPTION_ID=$value ;;
                esac
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            --*) invalid "unknown option '$1'." ;;
            *) invalid "unexpected positional argument '$1' in batch mode." ;;
        esac
    done
    [ -n "$REGION" ] || invalid "--region is required in batch mode."
    [ -n "$REQUIREMENTS_FILE" ] || invalid "--requirements-file is required in batch mode."
    [ -f "$REQUIREMENTS_FILE" ] && [ -r "$REQUIREMENTS_FILE" ] ||
        invalid "requirements file '$REQUIREMENTS_FILE' is not a readable file."
else
    [ "$#" -ge 2 ] || invalid "resource provider and region are required."
    [ "$#" -le 4 ] || invalid "too many positional arguments."
    LEGACY_PROVIDER=$1
    REGION=$2
    LEGACY_RESOURCE=${3:-}
    SUBSCRIPTION_ID=${4:-}
fi

case "$REGION" in
    ""|*[!A-Za-z0-9-]*) invalid "invalid region '$REGION'." ;;
esac

WORK_PREFIX=".check-quota.$$"
OUT_FILE="${WORK_PREFIX}.out"
ERR_FILE="${WORK_PREFIX}.err"
NORMALIZED_REQUIREMENTS="${WORK_PREFIX}.requirements"
trap 'rm -f "$OUT_FILE" "$ERR_FILE" "$NORMALIZED_REQUIREMENTS"' EXIT HUP INT TERM

if [ -n "$REQUIREMENTS_FILE" ]; then
    if command -v python3 >/dev/null 2>&1; then
        PYTHON=python3
    elif command -v python >/dev/null 2>&1 &&
         python -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
        PYTHON=python
    else
        operational_error "Python is required to parse the JSON requirements file."
    fi
    if "$PYTHON" - "$REQUIREMENTS_FILE" "$NORMALIZED_REQUIREMENTS" <<'PY'
import json
import sys

source, destination = sys.argv[1:3]
try:
    with open(source, "r", encoding="utf-8-sig") as stream:
        requirements = json.load(stream)
    if not isinstance(requirements, list):
        raise ValueError("root value must be an array")
    if not requirements:
        raise ValueError("array must contain at least one requirement")
    with open(destination, "w", encoding="utf-8", newline="\n") as stream:
        for index, requirement in enumerate(requirements):
            if not isinstance(requirement, dict):
                raise ValueError("item {} must be an object".format(index))
            unknown = set(requirement) - {
                "provider", "resourceName", "requested", "resourceType", "documentedLimit"
            }
            if unknown:
                raise ValueError("item {} has unknown field(s): {}".format(
                    index, ", ".join(sorted(unknown))))
            for field in ("provider", "resourceName", "requested"):
                if field not in requirement:
                    raise ValueError("item {} is missing '{}'".format(index, field))
            provider = requirement["provider"]
            resource_name = requirement["resourceName"]
            requested = requirement["requested"]
            resource_type = requirement.get("resourceType")
            documented_limit = requirement.get("documentedLimit")
            if not isinstance(provider, str) or not isinstance(resource_name, str):
                raise ValueError("item {} provider and resourceName must be strings".format(index))
            if isinstance(requested, bool) or not isinstance(requested, int) or requested < 0:
                raise ValueError("item {} requested must be a non-negative integer".format(index))
            if resource_type is not None and not isinstance(resource_type, str):
                raise ValueError("item {} resourceType must be a string".format(index))
            if documented_limit is not None and (
                    isinstance(documented_limit, bool) or
                    not isinstance(documented_limit, int) or documented_limit < 0):
                raise ValueError(
                    "item {} documentedLimit must be a non-negative integer".format(index))
            values = (provider, resource_name, str(requested),
                      resource_type or "",
                      "" if documented_limit is None else str(documented_limit))
            if any("\t" in value or "\r" in value or "\n" in value for value in values):
                raise ValueError("item {} contains a tab or newline".format(index))
            stream.write("\t".join(values) + "\n")
except (OSError, ValueError, json.JSONDecodeError) as error:
    sys.stderr.write("Invalid requirements file: {}\n".format(error))
    sys.exit(2)
PY
    then
        :
    else
        parse_status=$?
        if [ "$parse_status" -eq 2 ]; then
            exit 2
        fi
        operational_error "could not parse requirements file."
    fi
fi

command -v az >/dev/null 2>&1 || operational_error "Azure CLI 'az' is not installed."
ensure_extension "quota"
if [ -z "$SUBSCRIPTION_ID" ]; then
    if ! run_az account show --query id -o tsv; then
        operational_error "could not resolve the current Azure subscription: $(error_detail)"
    fi
    if ! IFS= read -r SUBSCRIPTION_ID <"$OUT_FILE"; then
        operational_error "Azure CLI returned no current subscription ID."
    fi
    SUBSCRIPTION_ID=${SUBSCRIPTION_ID%$'\r'}
fi
[ -n "$SUBSCRIPTION_ID" ] || invalid "subscription ID cannot be empty."

OVERALL="PASS"
printf 'Provider\tQuotaResource\tRegion\tRequested\tCurrentUsage\tLimit\tProjectedUsage\tAvailable\tStatus\tSource\n'

if [ -n "$REQUIREMENTS_FILE" ]; then
    requirement_count=0
    while IFS=$'\t' read -r provider quota_name requested arm_type documented_limit extra ||
          [ -n "${provider}${quota_name}${requested}${arm_type}${documented_limit}${extra}" ]; do
        [ -z "$extra" ] || operational_error "normalized requirements contain too many fields."
        check_requirement "$provider" "$quota_name" "$requested" "$arm_type" "$documented_limit"
        requirement_count=$((requirement_count + 1))
    done <"$NORMALIZED_REQUIREMENTS"
    [ "$requirement_count" -gt 0 ] || invalid "requirements file contains no requirements."
elif [ -n "$LEGACY_RESOURCE" ]; then
    check_requirement "$LEGACY_PROVIDER" "$LEGACY_RESOURCE" "0" "" ""
else
    validate_provider_and_region "$LEGACY_PROVIDER"
    scope="/subscriptions/$SUBSCRIPTION_ID/providers/$LEGACY_PROVIDER/locations/$REGION"
    if ! run_az quota list --scope "$scope" --query "[].name" -o tsv; then
        operational_error "quota discovery failed for '$LEGACY_PROVIDER': $(error_detail)"
    fi
    quota_names_file="${WORK_PREFIX}.names"
    cp "$OUT_FILE" "$quota_names_file" || operational_error "could not retain quota discovery results."
    trap 'rm -f "$OUT_FILE" "$ERR_FILE" "$NORMALIZED_REQUIREMENTS" "$quota_names_file"' EXIT HUP INT TERM
    quota_count=0
    while IFS= read -r quota_name || [ -n "$quota_name" ]; do
        quota_name=${quota_name%$'\r'}
        [ -n "$quota_name" ] || continue
        check_requirement "$LEGACY_PROVIDER" "$quota_name" "0" "" ""
        quota_count=$((quota_count + 1))
    done <"$quota_names_file"
    [ "$quota_count" -gt 0 ] || operational_error "quota discovery returned no resources for '$LEGACY_PROVIDER'."
fi

printf 'Overall\t%s\n' "$OVERALL"
[ "$OVERALL" != "INSUFFICIENT" ] || exit 1
exit 0
