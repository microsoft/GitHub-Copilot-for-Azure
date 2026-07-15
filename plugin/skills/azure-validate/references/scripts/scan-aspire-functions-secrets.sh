#!/usr/bin/env bash
# scan-aspire-functions-secrets.sh
# Aspire + Azure Functions secret-storage pre-provisioning scan.
#
# Decides whether the AzureWebJobsSecretStorageType=Files fix is required by
# scanning C# source for the Aspire Functions builder call and the setting.
#
# Logic:
#   1. Find *.cs files that call AddAzureFunctionsProject.
#   2. For each, check whether the same file already sets AzureWebJobsSecretStorageType.
#   3. Files with the call but missing the setting -> fix required.
#
# Usage:
#   ./scan-aspire-functions-secrets.sh [directory]
#
# Examples:
#   ./scan-aspire-functions-secrets.sh              # Scan current directory
#   ./scan-aspire-functions-secrets.sh ./src        # Scan a specific directory
#
# Output: a single verdict — NOT APPLICABLE, ALREADY CONFIGURED, or FIX REQUIRED
# (with the matching file(s) and line(s)). Exit code is 0 for every verdict;
# a non-zero exit only indicates a usage/environment error.

set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT" ]; then
  echo "ERROR: '$ROOT' is not a directory." >&2
  exit 2
fi

CALL="AddAzureFunctionsProject"
SETTING="AzureWebJobsSecretStorageType"

# Collect *.cs files that reference AddAzureFunctionsProject (NUL-delimited for safe paths).
matches=""
while IFS= read -r -d '' file; do
  if grep -q "$CALL" "$file"; then
    matches+="$file"$'\n'
  fi
done < <(find "$ROOT" -type f -name "*.cs" -print0)

# Strip trailing newline.
matches="${matches%$'\n'}"

if [ -z "$matches" ]; then
  echo "VERDICT: NOT APPLICABLE"
  echo "No '$CALL' call found in any *.cs file under '$ROOT'."
  echo "The Functions secret-storage check does not apply — skip it."
  exit 0
fi

# Partition matching files by whether they already configure the setting.
needs_fix=""
configured=""
while IFS= read -r file; do
  [ -n "$file" ] || continue
  if grep -q "$SETTING" "$file"; then
    configured+="$file"$'\n'
  else
    needs_fix+="$file"$'\n'
  fi
done <<< "$matches"

needs_fix="${needs_fix%$'\n'}"
configured="${configured%$'\n'}"

if [ -z "$needs_fix" ]; then
  echo "VERDICT: ALREADY CONFIGURED"
  echo "Every file that calls '$CALL' already sets '$SETTING':"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    line=$(grep -n "$SETTING" "$file" | head -n1 | cut -d: -f1)
    echo "  - $file (line $line)"
  done <<< "$configured"
  echo "No change required."
  exit 0
fi

echo "VERDICT: FIX REQUIRED"
echo "The following file(s) call '$CALL' but do NOT set '$SETTING':"
while IFS= read -r file; do
  [ -n "$file" ] || continue
  line=$(grep -n "$CALL" "$file" | head -n1 | cut -d: -f1)
  echo "  - $file (line $line)"
done <<< "$needs_fix"
echo ""
echo "Add .WithEnvironment(\"$SETTING\", \"Files\") to the AddAzureFunctionsProject"
echo "builder chain in each file above BEFORE running 'azd provision'."
exit 0
