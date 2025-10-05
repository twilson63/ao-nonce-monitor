#!/bin/bash
#
# Remove the test cron job
#

echo "=== REMOVE TEST CRON JOB ==="
echo ""

# Remove lines containing the test marker and the nonce monitor test
crontab -l 2>/dev/null | grep -v "# TEST: Nonce monitor" | grep -v "nonce-monitor-cron-test.log" | crontab -

echo "✓ Test cron job removed!"
echo ""
echo "Current crontab:"
crontab -l 2>/dev/null || echo "(empty)"
echo ""

# Show the log file location
TEST_LOG="$HOME/nonce-monitor-cron-test.log"
if [ -f "$TEST_LOG" ]; then
    echo "Test log file still exists at: $TEST_LOG"
    echo "Last 10 lines:"
    tail -10 "$TEST_LOG"
    echo ""
    read -p "Delete test log file? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$TEST_LOG"
        echo "✓ Test log deleted"
    fi
fi
