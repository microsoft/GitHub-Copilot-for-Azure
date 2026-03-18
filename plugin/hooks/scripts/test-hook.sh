#!/bin/bash
# Simple test hook - just writes to a file to prove it's running

# Get script directory and hooks directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$HOOKS_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

TEST_LOG_FILE="$LOGS_DIR/test-hook-executed.log"
ERROR_LOG_FILE="$LOGS_DIR/test-hook-error.log"

# Get timestamp in ISO 8601 format (UTC)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

# Error handling function
log_error() {
    echo "[$TIMESTAMP] Error: $1" >> "$ERROR_LOG_FILE"
    echo '{"continue": true}'
    exit 0
}

# Trap errors
trap 'log_error "Script failed at line $LINENO"' ERR

# Read stdin input if available
STDIN_INPUT=""
if [ ! -t 0 ]; then
    STDIN_INPUT=$(cat)
fi

# Write log entry
echo "[$TIMESTAMP] Hook executed successfully" >> "$TEST_LOG_FILE"

# Log input if received
if [ -n "$STDIN_INPUT" ]; then
    INPUT_LENGTH=${#STDIN_INPUT}
    echo "Input received (length: $INPUT_LENGTH chars)" >> "$TEST_LOG_FILE"
    
    # Log first 200 chars as preview
    if [ $INPUT_LENGTH -gt 200 ]; then
        PREVIEW="${STDIN_INPUT:0:200}"
    else
        PREVIEW="$STDIN_INPUT"
    fi
    echo "Preview: $PREVIEW" >> "$TEST_LOG_FILE"
fi

# Return success
echo '{"continue": true}'
exit 0
