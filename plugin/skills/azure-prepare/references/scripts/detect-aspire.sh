#!/usr/bin/env bash
# detect-aspire.sh
# Detects whether a workspace is a .NET Aspire application and gathers the
# facts the azure-prepare skill needs to plan deployment.
#
# It runs the full deterministic detection sequence in one pass:
#   1. Find the AppHost project (*.AppHost.csproj)
#   2. Confirm Aspire.Hosting or Aspire.AppHost.Sdk package references
#   3. Derive the AppHost source directory
#   4. Scan the AppHost *.cs for ExcludeFromManifest (informational)
#   5. Scan for AddAzureFunctionsProject, and if present, check whether
#      AzureWebJobsSecretStorageType is already configured
#
# Output: key=value lines the agent can branch on, followed by a human-readable
# summary. The remediation decision (whether/how to add
# .WithEnvironment("AzureWebJobsSecretStorageType", "Files")) stays with the agent.
#
# Usage:
#   ./detect-aspire.sh [workspace-root]
#
# Examples:
#   ./detect-aspire.sh                 # Scan the current directory
#   ./detect-aspire.sh ./src/MyApp     # Scan a specific workspace root

set -euo pipefail

WORKSPACE_ROOT="${1:-.}"

if [ ! -d "$WORKSPACE_ROOT" ]; then
    echo "Error: workspace root '$WORKSPACE_ROOT' is not a directory" >&2
    exit 1
fi

# Strip the workspace-root prefix and emit a "./"-prefixed, forward-slash
# workspace-relative path. Keeps output identical across shells/platforms.
to_relative() {
    local p="$1"
    case "$p" in
        "$WORKSPACE_ROOT"/*) p="${p#"$WORKSPACE_ROOT"/}" ;;
        ./*)                 p="${p#./}" ;;
    esac
    printf './%s' "$p"
}

# Portable recursive match over *.csproj files (BSD/macOS-safe: no `grep --include`).
# Returns 0 if the extended-regex pattern is found in any *.csproj under the directory.
csproj_match() {
    local dir="$1" pattern="$2"
    [ -n "$(find "$dir" -type f -name '*.csproj' -exec grep -lE "$pattern" {} + 2>/dev/null)" ]
}

# Portable recursive match over *.cs files, pruning bin/ and obj/ build output.
# Returns 0 if the extended-regex pattern is found in any *.cs under the directory.
cs_match() {
    local dir="$1" pattern="$2"
    [ -n "$(find "$dir" -type d \( -name bin -o -name obj \) -prune -o \
        -type f -name '*.cs' -exec grep -lE "$pattern" {} + 2>/dev/null)" ]
}

# Defaults (emitted when the workspace is not an Aspire app)
IS_ASPIRE="false"
APPHOST_PATH=""
APPHOST_DIR=""
HAS_EXCLUDE_FROM_MANIFEST="false"
HAS_FUNCTIONS="false"
SECRET_STORAGE_CONFIGURED="false"

# Step 1: Find the AppHost project (case-insensitive sort for deterministic,
# cross-shell-consistent selection)
APPHOST_RAW=$(find "$WORKSPACE_ROOT" -type f -name "*.AppHost.csproj" 2>/dev/null | sort -f | head -1 || true)

# Step 2: Confirm Aspire package references anywhere in the workspace
HAS_ASPIRE_PACKAGE="false"
if csproj_match "$WORKSPACE_ROOT" "Aspire\.Hosting|Aspire\.AppHost\.Sdk"; then
    HAS_ASPIRE_PACKAGE="true"
fi

if [ -n "$APPHOST_RAW" ] || [ "$HAS_ASPIRE_PACKAGE" = "true" ]; then
    IS_ASPIRE="true"
fi

if [ -n "$APPHOST_RAW" ]; then
    APPHOST_PATH=$(to_relative "$APPHOST_RAW")

    # Step 3: Derive the AppHost source directory (scan the real path on disk)
    APPHOST_DIR=$(dirname "$APPHOST_PATH")
    APPHOST_DIR_RAW=$(dirname "$APPHOST_RAW")

    # Step 4: Scan the AppHost source for ExcludeFromManifest (informational)
    if cs_match "$APPHOST_DIR_RAW" "ExcludeFromManifest"; then
        HAS_EXCLUDE_FROM_MANIFEST="true"
    fi

    # Step 5: Detect Azure Functions and secret-storage configuration
    if cs_match "$APPHOST_DIR_RAW" "AddAzureFunctionsProject"; then
        HAS_FUNCTIONS="true"
        if cs_match "$APPHOST_DIR_RAW" "AzureWebJobsSecretStorageType"; then
            SECRET_STORAGE_CONFIGURED="true"
        fi
    fi
fi

# Machine-readable result
echo "isAspire=$IS_ASPIRE"
echo "appHostPath=$APPHOST_PATH"
echo "appHostDir=$APPHOST_DIR"
echo "hasExcludeFromManifest=$HAS_EXCLUDE_FROM_MANIFEST"
echo "hasFunctions=$HAS_FUNCTIONS"
echo "secretStorageConfigured=$SECRET_STORAGE_CONFIGURED"

# Human-readable summary
echo ""
echo "Summary:"
if [ "$IS_ASPIRE" != "true" ]; then
    echo "- No .NET Aspire app detected in '$WORKSPACE_ROOT' (no *.AppHost.csproj or Aspire.Hosting / Aspire.AppHost.Sdk package reference)."
    exit 0
fi

if [ -n "$APPHOST_PATH" ]; then
    echo "- .NET Aspire app detected. AppHost project: $APPHOST_PATH"
    echo "- AppHost source directory: $APPHOST_DIR"
else
    echo "- Aspire.Hosting / Aspire.AppHost.Sdk package reference found, but no *.AppHost.csproj was located."
fi

if [ "$HAS_EXCLUDE_FROM_MANIFEST" = "true" ]; then
    echo "- ExcludeFromManifest found in AppHost source (informational): the app may contain local-only resources."
else
    echo "- No ExcludeFromManifest usage found in AppHost source."
fi

if [ "$HAS_FUNCTIONS" = "true" ]; then
    if [ "$SECRET_STORAGE_CONFIGURED" = "true" ]; then
        echo "- AddAzureFunctionsProject found; AzureWebJobsSecretStorageType is configured in the AppHost source."
    else
        echo "- AddAzureFunctionsProject found; AzureWebJobsSecretStorageType is not configured in the AppHost source."
    fi
else
    echo "- AddAzureFunctionsProject not found in AppHost source."
fi
