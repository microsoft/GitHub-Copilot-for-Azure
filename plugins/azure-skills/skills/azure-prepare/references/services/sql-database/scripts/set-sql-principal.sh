#!/usr/bin/env bash
# Set the signed-in user's identity as the Azure SQL Entra administrator in an azd environment.
#
# Exit codes:
#   0 - Variables set successfully, or help displayed
#   1 - A dependency, identity lookup, or azd environment update failed
#   2 - Invalid arguments
#
# Usage:
#   ./set-sql-principal.sh [-e <azd-environment>]

set -e

usage() {
  cat <<'EOF'
Usage: ./set-sql-principal.sh [-e <azd-environment>]

Options:
  -e, --environment <name>  Set values in the named azd environment.
  -h, --help                Show this help.
EOF
}

AZD_ENV_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -e|--environment)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "ERROR: $1 requires an azd environment name." >&2
        usage >&2
        exit 2
      fi
      AZD_ENV_ARGS=(-e "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: Azure CLI ('az') is not installed or is not on PATH." >&2
  exit 1
fi

if ! command -v azd >/dev/null 2>&1; then
  echo "ERROR: Azure Developer CLI ('azd') is not installed or is not on PATH." >&2
  exit 1
fi

if ! PRINCIPAL_INFO=$(az ad signed-in-user show --query "{id:id, name:displayName}" -o tsv); then
  echo "ERROR: Could not resolve the signed-in Azure user. Run 'az login' with a user identity and retry." >&2
  exit 1
fi

TAB=$(printf '\t')
case "$PRINCIPAL_INFO" in
  *"$TAB"*)
    PRINCIPAL_ID=${PRINCIPAL_INFO%%"$TAB"*}
    PRINCIPAL_NAME=${PRINCIPAL_INFO#*"$TAB"}
    ;;
  *)
    echo "ERROR: Azure CLI returned incomplete signed-in user information." >&2
    exit 1
    ;;
esac

if [ -z "$PRINCIPAL_ID" ] || [ -z "$PRINCIPAL_NAME" ]; then
  echo "ERROR: Azure CLI returned an empty user object ID or display name." >&2
  exit 1
fi

if ! azd env set "${AZD_ENV_ARGS[@]}" --no-prompt \
  "AZURE_PRINCIPAL_ID=$PRINCIPAL_ID" \
  "AZURE_PRINCIPAL_NAME=$PRINCIPAL_NAME"; then
  echo "ERROR: Could not update the azd environment. Run 'azd init' or select an environment and retry." >&2
  exit 1
fi

echo "AZURE_PRINCIPAL_ID: set to $PRINCIPAL_ID"
echo "AZURE_PRINCIPAL_NAME: set to $PRINCIPAL_NAME"
