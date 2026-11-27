#!/usr/bin/env bash
# Build the MSBench agent package: the official Copilot CLI agent files plus our agent/ scripts.
#
# Usage: build-agent.sh <agent-dir> <copilot-model> <backend> <output-dir>
# Exit codes: 0 success, 1 a command failed, 2 usage error.
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "Usage: build-agent.sh <agent-dir> <copilot-model> <backend> <output-dir>" >&2
  exit 2
fi
agent_dir="$1"
copilot_model="$2"
backend="$3"
out="$4"

work="$(mktemp -d)"
rm -rf "$out"
mkdir -p "$out"

# Official files: package downloader, entry.sh, setup.sh and agent_profile.yml.
msbench-agent-github-copilot-cli prepare --work_dir "$work/work" --output_dir "$work/out" --backend "$backend"
cp "$work/work/agent/agent-downloader.sh" "$work/work/agent/entry.sh" "$work/work/agent/agent_profile.yml" "$out/"
cp "$work/work/agent/setup.sh" "$out/setup-base.sh"

# Our setup.sh and runner.sh wrap the official ones.
cp "$agent_dir"/*.sh "$out/"
echo "export COPILOT_AGENT_MODEL='$copilot_model'" > "$out/model.env"
rm -rf "$work"
ls -l "$out"
