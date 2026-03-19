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
echo "[$TIMESTAMP] ==============================================" >> "$TEST_LOG_FILE"
echo "[$TIMESTAMP] Hook executed successfully" >> "$TEST_LOG_FILE"

# Log input if received
if [ -n "$STDIN_INPUT" ]; then
    INPUT_LENGTH=${#STDIN_INPUT}
    echo "[$TIMESTAMP] Input received (length: $INPUT_LENGTH chars)" >> "$TEST_LOG_FILE"
    echo "" >> "$TEST_LOG_FILE"
    
    # Log the full raw input
    echo "[$TIMESTAMP] === RAW INPUT ===" >> "$TEST_LOG_FILE"
    echo "$STDIN_INPUT" >> "$TEST_LOG_FILE"
    echo "" >> "$TEST_LOG_FILE"
    
    # Try to parse as JSON and log pretty-printed version
    if command -v jq >/dev/null 2>&1; then
        echo "[$TIMESTAMP] === PARSED JSON (Pretty) ===" >> "$TEST_LOG_FILE"
        echo "$STDIN_INPUT" | jq '.' >> "$TEST_LOG_FILE" 2>/dev/null || echo "Failed to parse JSON" >> "$TEST_LOG_FILE"
        echo "" >> "$TEST_LOG_FILE"
        
        # Extract and log key fields
        echo "[$TIMESTAMP] === KEY FIELDS ===" >> "$TEST_LOG_FILE"
        echo "tool_name: $(echo "$STDIN_INPUT" | jq -r '.tool_name // "N/A"')" >> "$TEST_LOG_FILE"
        echo "toolName: $(echo "$STDIN_INPUT" | jq -r '.toolName // "N/A"')" >> "$TEST_LOG_FILE"
        echo "session_id: $(echo "$STDIN_INPUT" | jq -r '.session_id // "N/A"')" >> "$TEST_LOG_FILE"
        echo "sessionId: $(echo "$STDIN_INPUT" | jq -r '.sessionId // "N/A"')" >> "$TEST_LOG_FILE"
        echo "version: $(echo "$STDIN_INPUT" | jq -r '.version // "N/A"')" >> "$TEST_LOG_FILE"
        echo "cwd: $(echo "$STDIN_INPUT" | jq -r '.cwd // "N/A"')" >> "$TEST_LOG_FILE"
        echo "" >> "$TEST_LOG_FILE"
        
        # Log all top-level keys
        echo "[$TIMESTAMP] === ALL TOP-LEVEL KEYS ===" >> "$TEST_LOG_FILE"
        echo "$STDIN_INPUT" | jq -r 'keys[]' >> "$TEST_LOG_FILE" 2>/dev/null || echo "Failed to extract keys" >> "$TEST_LOG_FILE"
        echo "" >> "$TEST_LOG_FILE"
    else
        echo "[$TIMESTAMP] jq not found - cannot parse JSON" >> "$TEST_LOG_FILE"
    fi
fi

echo "[$TIMESTAMP] ==============================================" >> "$TEST_LOG_FILE"
echo "" >> "$TEST_LOG_FILE"

# Return success
echo '{"continue": true}'
exit 0
