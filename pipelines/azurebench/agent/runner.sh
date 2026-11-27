#!/bin/bash
set -e

# model.env is written by the pipeline and sets COPILOT_AGENT_MODEL.
if [ -f "${AGENT_DIR}/model.env" ]; then source "${AGENT_DIR}/model.env"; fi

# Without our CAPI key, use the CES proxy with MSBench's autodev-test integration.
# Same settings MSBench generates for its built-in msbench-default-index.
if [ -z "${CAPI_HMAC_KEY:-}" ]; then
    export COPILOT_API_URL="${COPILOT_API_URL:-https://ces-dev1.azurewebsites.net/api/copilot}"
    export GITHUB_COPILOT_INTEGRATION_ID="${GITHUB_COPILOT_INTEGRATION_ID:-autodev-test}"
    if [ -z "${GITHUB_COPILOT_API_TOKEN:-}" ]; then
        GITHUB_COPILOT_API_TOKEN="$(az account get-access-token --scope api://17b0ad65-ed36-4194-bb27-059c567bc41f/.default --query accessToken --output tsv)"
        export GITHUB_COPILOT_API_TOKEN
    fi
fi
source "${AGENT_DIR}/activate-copilot.sh"
export COPILOT_ENABLE_ALT_PROVIDERS=true
export COPILOT_CLI_ENABLED_FEATURE_FLAGS=SKILLS_INSTRUCTIONS
source "${AGENT_DIR}/runner-base.sh"
