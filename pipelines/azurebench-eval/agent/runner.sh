#!/bin/bash
set -e

# model.env is written by the pipeline and sets COPILOT_AGENT_MODEL.
if [ -f "${AGENT_DIR}/model.env" ]; then source "${AGENT_DIR}/model.env"; fi
source "${AGENT_DIR}/activate-copilot.sh"
export COPILOT_ENABLE_ALT_PROVIDERS=true
export COPILOT_CLI_ENABLED_FEATURE_FLAGS=SKILLS_INSTRUCTIONS
source "${AGENT_DIR}/runner-base.sh"
