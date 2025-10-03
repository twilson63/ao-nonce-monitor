#!/bin/bash
#
# Slot-aware wrapper for AO Network Nonce Monitor
# Runs only at 500-slot boundaries for precise synchronization
#

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Get process ID from environment or config
PROCESS_ID=${PROCESS_ID:-"0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc"}

# Get current slot from state endpoint
CURRENT_SLOT=$(curl -s "https://state.forward.computer/$PROCESS_ID/compute/at-slot" 2>/dev/null)

# Verify we got a valid slot number
if ! [[ "$CURRENT_SLOT" =~ ^[0-9]+$ ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)] ERROR: Failed to get current slot (got: $CURRENT_SLOT)"
    exit 1
fi

# Calculate if we're at a 500-slot boundary
SLOT_INTERVAL=500
REMAINDER=$((CURRENT_SLOT % SLOT_INTERVAL))
TOLERANCE=5  # Allow ±5 slots tolerance

# Run monitor if we're close to a 500-slot boundary
if [ $REMAINDER -lt $TOLERANCE ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)] Running at slot $CURRENT_SLOT (boundary: $((CURRENT_SLOT - REMAINDER)))"
    /usr/bin/node "$SCRIPT_DIR/nonce-monitor.js"
else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)] Skipping - not at $SLOT_INTERVAL-slot boundary (current: $CURRENT_SLOT, remainder: $REMAINDER)"
fi
