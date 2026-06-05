#!/usr/bin/env bash
# detect-aspire.sh
# Detects whether a workspace is a .NET Aspire application and gathers the
# facts the azure-prepare skill needs to plan deployment.
#
# It runs the full deterministic detection sequence in one pass:
#   1. Find the AppHost project (*.AppHost.csproj)
#   2. Confirm Aspire.Hosting package references
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

# Defaults (emitted when the workspace is not an Aspire app)
IS_ASPIRE="false"
APPHOST_PATH=""
APPHOST_DIR=""
HAS_EXCLUDE_FROM_MANIFEST="false"
HAS_FUNCTIONS="false"
SECRET_STORAGE_CONFIGURED="false"

# Step 1: Find the AppHost project
APPHOST_PATH=$(find "$WORKSPACE_ROOT" -name "*.AppHost.csproj" 2>/dev/null | head -1 || true)

# Step 2: Confirm Aspire.Hosting package references anywhere in the workspace
HAS_ASPIRE_PACKAGE="false"
if grep -rql "Aspire.Hosting" "$WORKSPACE_ROOT" --include="*.csproj" 2>/dev/null; then
    HAS_ASPIRE_PACKAGE="true"
fi

if [ -n "$APPHOST_PATH" ] || [ "$HAS_ASPIRE_PACKAGE" = "true" ]; then
    IS_ASPIRE="true"
fi

if [ -n "$APPHOST_PATH" ]; then
    # Step 3: Derive the AppHost source directory
    APPHOST_DIR=$(dirname "$APPHOST_PATH")

    # Step 4: Scan the AppHost source for ExcludeFromManifest (informational)
    if grep -rq "ExcludeFromManifest" "$APPHOST_DIR" --include="*.cs" 2>/dev/null; then
        HAS_EXCLUDE_FROM_MANIFEST="true"
    fi

    # Step 5: Detect Azure Functions and secret-storage configuration
    if grep -rq "AddAzureFunctionsProject" "$APPHOST_DIR" --include="*.cs" 2>/dev/null; then
        HAS_FUNCTIONS="true"
        if grep -rq "AzureWebJobsSecretStorageType" "$APPHOST_DIR" --include="*.cs" 2>/dev/null; then
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
    echo "- No .NET Aspire app detected in '$WORKSPACE_ROOT' (no *.AppHost.csproj or Aspire.Hosting package reference)."
    exit 0
fi

if [ -n "$APPHOST_PATH" ]; then
    echo "- .NET Aspire app detected. AppHost project: $APPHOST_PATH"
    echo "- AppHost source directory: $APPHOST_DIR"
else
    echo "- Aspire.Hosting package reference found, but no *.AppHost.csproj was located."
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
