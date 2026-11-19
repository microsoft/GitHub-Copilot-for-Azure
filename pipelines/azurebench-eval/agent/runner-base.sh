#!/bin/bash
# GitHub Copilot CLI Runner Script (Auto-generated)
# This script runs the agent using environment variables from model configuration.

set -e

# Model-specific configuration
if [ -z "$COPILOT_AGENT_MODEL" ]; then export COPILOT_AGENT_MODEL=sweagent-capi:claude-opus-4.5; fi

# Change to the agent directory
cd "$AGENT_DIR"

# Run the agent
. entry.sh
