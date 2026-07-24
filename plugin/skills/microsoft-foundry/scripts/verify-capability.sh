#!/usr/bin/env bash

set -u

if ! command -v azd >/dev/null 2>&1; then
  echo "Detected: azd is not installed. Recommend installing Azure Developer CLI for the full Microsoft Foundry skill experience; ask the user first, because installation is optional."
  exit 0
fi

if ! extension_list="$(AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd extension list --installed --output json 2>/dev/null)"; then
  echo "Detected: azd is installed, but its extensions could not be inspected. If you later work on a Foundry agent, always remember to run the verify-environment script in the create sub-skill to verify and install the local-development environment."
  exit 0
fi

if printf '%s' "$extension_list" | grep -Eq '"id"[[:space:]]*:[[:space:]]*"microsoft\.foundry"'; then
  echo "Detected: azd and microsoft.foundry are installed. Basic Microsoft Foundry capability is ready."
else
  echo "Detected: microsoft.foundry is not installed. Microsoft Foundry capability is not ready. If you later work on a Foundry agent, always remember to run the verify-environment script in the create sub-skill to verify and install the local-development environment."
fi
