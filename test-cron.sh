#!/bin/bash
#
# Test cron setup locally before deploying to production
#

echo "=== CRON SETUP TEST ==="
echo ""

# 1. Test wrapper script exists and is executable
echo "1. Checking wrapper scripts..."
if [ -x "./run-nonce-monitor.sh" ]; then
    echo "   ✓ run-nonce-monitor.sh is executable"
else
    echo "   ✗ run-nonce-monitor.sh not executable"
    echo "   Run: chmod +x run-nonce-monitor.sh"
fi

if [ -x "./slot-aware-monitor.sh" ]; then
    echo "   ✓ slot-aware-monitor.sh is executable"
else
    echo "   ✗ slot-aware-monitor.sh not executable"
    echo "   Run: chmod +x slot-aware-monitor.sh"
fi
echo ""

# 2. Test wrapper script execution
echo "2. Testing run-nonce-monitor.sh..."
./run-nonce-monitor.sh 2>&1 | head -10
echo ""

# 3. Test slot-aware wrapper
echo "3. Testing slot-aware-monitor.sh..."
./slot-aware-monitor.sh 2>&1 | head -10
echo ""

# 4. Simulate cron environment
echo "4. Testing in simulated cron environment (minimal PATH)..."
env -i PATH=/usr/bin:/bin HOME=$HOME ./run-nonce-monitor.sh 2>&1 | head -10
echo ""

# 5. Test log redirection
echo "5. Testing log file redirection..."
TEST_LOG="/tmp/nonce-monitor-test.log"
./run-nonce-monitor.sh >> "$TEST_LOG" 2>&1
if [ -f "$TEST_LOG" ]; then
    echo "   ✓ Log file created: $TEST_LOG"
    echo "   Last 5 lines:"
    tail -5 "$TEST_LOG" | sed 's/^/   /'
    rm "$TEST_LOG"
else
    echo "   ✗ Log file not created"
fi
echo ""

# 6. Check Node.js path
echo "6. Checking Node.js installation..."
NODE_PATH=$(which node)
echo "   Node.js path: $NODE_PATH"
echo "   Node.js version: $(node --version)"
echo ""

# 7. Test cron syntax
echo "7. Suggested cron entries:"
echo ""
echo "   Every 5 minutes (standard):"
echo "   */5 * * * * $(pwd)/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1"
echo ""
echo "   Slot-aware (every minute, checks slot):"
echo "   * * * * * $(pwd)/slot-aware-monitor.sh >> /var/log/nonce-monitor.log 2>&1"
echo ""

# 8. Check current crontab
echo "8. Current crontab entries:"
crontab -l 2>/dev/null | grep -i nonce || echo "   No nonce monitor entries found"
echo ""

echo "=== TEST COMPLETE ==="
echo ""
echo "Next steps:"
echo "1. Review test output above"
echo "2. If all tests pass, add to crontab: crontab -e"
echo "3. Monitor logs: tail -f /var/log/nonce-monitor.log"
