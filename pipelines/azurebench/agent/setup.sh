#!/bin/bash
set -euo pipefail

bash "${AGENT_DIR}/setup-base.sh"
source "${AGENT_DIR}/activate-copilot.sh"
export COPILOT_ENABLE_ALT_PROVIDERS=true
copilot plugin marketplace add microsoft/azure-skills
copilot plugin install azure@azure-skills
