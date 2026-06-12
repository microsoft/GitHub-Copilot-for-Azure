#!/bin/bash
# Initialize an AZD template, set location, then provision and deploy.
#
# USAGE:
#   ./azd-provision-deploy.sh <template> <region> [env-name] [--up] [--init-only]
#
# ARGUMENTS:
#   template   AZD template name or repository.
#   region     Azure region for AZURE_LOCATION.
#   env-name   Optional AZD environment name. Defaults to <cwd-slug>-dev.
#   --up       Use azd up --no-prompt instead of provision, wait, deploy.
#   --init-only Initialize the template and exit.

set -euo pipefail

usage() {
  echo "usage=azd-provision-deploy.sh <template> <region> [env-name] [--up] [--init-only]"
  exit 2
}

USE_UP=false
INIT_ONLY=false
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --up) USE_UP=true ;;
    --init-only) INIT_ONLY=true ;;
    -h|--help) usage ;;
    *) ARGS+=("$arg") ;;
  esac
done

if [ "${#ARGS[@]}" -lt 2 ] || [ "${#ARGS[@]}" -gt 3 ]; then
  usage
fi

TEMPLATE="${ARGS[0]}"
REGION="${ARGS[1]}"
ENV_NAME="${ARGS[2]:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev}"

if [ "$INIT_ONLY" = true ]; then
  MODE="init-only"
  PHASES="init"
elif [ "$USE_UP" = true ]; then
  MODE="up"
  PHASES="init,env-set,up"
else
  MODE="provision-deploy"
  PHASES="init,env-set,provision,wait,deploy"
fi

echo "env_name=$ENV_NAME"
echo "template=$TEMPLATE"
echo "region=$REGION"
echo "mode=$MODE"
echo "phases=$PHASES"

if [ -f "azure.yaml" ]; then
  echo "init=skipped-existing-azure-yaml"
else
  azd init -t "$TEMPLATE" -e "$ENV_NAME" --no-prompt
  echo "init=completed"
fi

if [ "$INIT_ONLY" = true ]; then
  echo "result=initialized"
  echo "Initialized '$ENV_NAME' from '$TEMPLATE'."
  exit 0
fi

azd env set AZURE_LOCATION "$REGION"

if [ "$USE_UP" = true ]; then
  azd up --no-prompt
  echo "result=deployed-with-azd-up"
  echo "Initialized and deployed '$ENV_NAME' in '$REGION' with azd up."
else
  azd provision --no-prompt
  sleep 60
  azd deploy --no-prompt
  echo "result=provisioned-then-deployed"
  echo "Provisioned then deployed '$ENV_NAME' in '$REGION'."
fi