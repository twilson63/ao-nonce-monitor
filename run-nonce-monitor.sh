#!/bin/bash
#
# Wrapper script for running AO Network Nonce Monitor in cron
# This script loads environment variables and executes the monitor
#

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env file if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Or set environment variables directly here:
# export PROCESS_ID="0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc"
# export REQUEST_TIMEOUT=10000
# export CONFIG_FILE="$SCRIPT_DIR/process-ids.txt"
# export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Run the nonce monitor
/usr/bin/node "$SCRIPT_DIR/nonce-monitor.js"
