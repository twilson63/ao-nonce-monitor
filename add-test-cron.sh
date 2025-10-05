#!/bin/bash
#
# Add a test cron job that runs every minute for 5 minutes
# This helps verify cron is working before deploying production schedule
#

echo "=== ADD TEST CRON JOB ==="
echo ""
echo "This will add a temporary cron job that runs every minute."
echo "You can monitor it for a few minutes to verify everything works."
echo ""

# Create a temporary log file
TEST_LOG="$HOME/nonce-monitor-cron-test.log"
echo "Log file: $TEST_LOG"
echo ""

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Show what will be added
echo "Cron entry to add:"
echo "* * * * * $SCRIPT_DIR/run-nonce-monitor.sh >> $TEST_LOG 2>&1"
echo ""

read -p "Add this test cron job? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Add to crontab
    (crontab -l 2>/dev/null; echo "# TEST: Nonce monitor - remove after testing") | crontab -
    (crontab -l 2>/dev/null; echo "* * * * * $SCRIPT_DIR/run-nonce-monitor.sh >> $TEST_LOG 2>&1") | crontab -
    
    echo "✓ Test cron job added!"
    echo ""
    echo "Monitoring log (press Ctrl+C to stop)..."
    echo "The cron job will run at the next minute mark."
    echo ""
    
    # Create log file if it doesn't exist
    touch "$TEST_LOG"
    
    # Wait for the next minute
    echo "Waiting for next minute..."
    sleep $((60 - $(date +%S)))
    
    # Monitor the log
    tail -f "$TEST_LOG"
else
    echo "Cancelled."
fi
