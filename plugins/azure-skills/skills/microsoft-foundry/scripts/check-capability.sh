#!/usr/bin/env bash

set -u

if ! command -v azd >/dev/null 2>&1; then
  echo "Detected: azd is not installed. Some Microsoft Foundry skill capabilities may be unavailable. Ask whether the user wants to install Azure Developer CLI; installation is optional. If they agree, open https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd for installation instructions, then rerun this script."
  exit 0
fi

if ! extension_list="$(AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd extension list --installed --output json 2>/dev/null)"; then
  echo 'Detected: Foundry agent development capability could not be checked. If Foundry agent local development is needed, run the "Verify the environment" step in the create sub-skill to unlock the full local-development capability.'
  exit 0
fi

if printf '%s' "$extension_list" | grep -Eq '"id"[[:space:]]*:[[:space:]]*"microsoft\.foundry"'; then
  echo "Detected: azd and microsoft.foundry are installed. Foundry agent development capability is ready."
else
  echo 'Detected: microsoft.foundry is not installed. Foundry agent development capability is not ready. If Foundry agent local development is needed, run the "Verify the environment" step in the create sub-skill to unlock the full local-development capability.'
fi
