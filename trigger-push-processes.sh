#!/bin/bash

# Script to trigger cron calls for all push-{x} processes in process-map.json

# Read process-map.json and filter for push-{x} entries
echo "Reading process-map.json and filtering for push-{x} processes..."

# Use jq to parse JSON and extract push-{x} entries
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    exit 1
fi

# Get current timestamp for logging
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[$timestamp] Starting push process triggers..."

# Count total push processes
total_push=$(jq -r 'to_entries[] | select(.value | contains("push-")) | .key' process-map.json | wc -l)
echo "Found $total_push push processes to trigger"

# Process each push-{x} entry
jq -r 'to_entries[] | select(.value | contains("push-")) | .key + "|" + .value' process-map.json | while IFS='|' read -r key url; do
    # Extract the push number from URL (e.g., "push-5" from "https://push-5.forward.computer")
    push_num=$(echo "$url" | sed -n 's/.*push-\([0-9]*\).*/\1/p')
    
    if [ -n "$push_num" ]; then
        echo "Processing push-$push_num for key: $key"
        
        # Build the curl command
        curl_url="https://push-${push_num}.forward.computer/~cron@1.0/once?cron-path=${key}~process@1.0/now"
        
        echo "Calling: $curl_url"
        
        # Make the curl call
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$curl_url" 2>&1)
        http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
        body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
        
        if [ "$http_status" = "200" ]; then
            echo "✓ Success for push-$push_num (HTTP $http_status)"
        else
            echo "✗ Failed for push-$push_num (HTTP $http_status)"
            echo "Response: $body"
        fi
        
        echo "---"
    fi
done

echo "[$timestamp] Completed push process triggers"