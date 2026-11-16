#!/bin/bash
set -e

source "${AGENT_DIR}/activate-copilot.sh"
export COPILOT_ENABLE_ALT_PROVIDERS=true
export COPILOT_CLI_ENABLED_FEATURE_FLAGS=SKILLS_INSTRUCTIONS
source "${AGENT_DIR}/runner-base.sh"
