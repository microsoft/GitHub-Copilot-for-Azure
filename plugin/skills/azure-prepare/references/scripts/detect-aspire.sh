#!/usr/bin/env bash
# detect-aspire.sh
# Presence check: determines whether a workspace is a .NET Aspire application.
# Use this at detection/routing points where you only need a yes/no answer.
# To gather the deeper deployment facts (ExcludeFromManifest, Azure Functions,
# secret storage, AppHost source dir), use gather-aspire-info.sh instead.
#
# It runs the minimal deterministic presence sequence:
#   1. Find the AppHost project (*.AppHost.csproj)
#   2. Confirm Aspire.Hosting or Aspire.AppHost.Sdk package references
#
# Output: key=value lines (isAspire, appHostPath) followed by a short
# human-readable summary.
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

# Defaults (emitted when the workspace is not an Aspire app)
IS_ASPIRE="false"
APPHOST_PATH=""

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
fi

# Machine-readable result
echo "isAspire=$IS_ASPIRE"
echo "appHostPath=$APPHOST_PATH"

# Human-readable summary
echo ""
echo "Summary:"
if [ "$IS_ASPIRE" != "true" ]; then
    echo "- No .NET Aspire app detected in '$WORKSPACE_ROOT' (no *.AppHost.csproj or Aspire.Hosting / Aspire.AppHost.Sdk package reference)."
    exit 0
fi

if [ -n "$APPHOST_PATH" ]; then
    echo "- .NET Aspire app detected. AppHost project: $APPHOST_PATH"
else
    echo "- Aspire.Hosting / Aspire.AppHost.Sdk package reference found, but no *.AppHost.csproj was located."
fi
echo "- Run gather-aspire-info.sh to gather other essential deployment information."
