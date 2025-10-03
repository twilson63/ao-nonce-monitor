# Cron Setup for 500-Slot Intervals

## Overview

This guide explains how to set up the AO Network Nonce Monitor to run every 500 slots on the AO network.

## Understanding AO Network Slots

The AO network uses slots as a measure of time/blocks. To run the monitor every 500 slots, we need to:
1. Determine the slot duration (time per slot)
2. Calculate the cron interval (500 slots × time per slot)
3. Configure cron accordingly

## Slot Timing Assumptions

**Common AO Network Configurations:**
- **Fast networks:** ~1 slot per second → 500 slots = ~8.3 minutes
- **Typical networks:** ~2 slots per second → 500 slots = ~4.2 minutes  
- **Slower networks:** 1 slot per 2 seconds → 500 slots = ~16.6 minutes

**For this guide, we'll assume ~2 slots per second (Ethereum-like timing):**
- **500 slots ≈ 4-5 minutes**

## Recommended Cron Schedule

### Every 5 Minutes (Conservative)
```bash
*/5 * * * * /usr/bin/node /path/to/ao-nonce-monitor/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### Every 4 Minutes (Closer to 500 slots)
```bash
*/4 * * * * /usr/bin/node /path/to/ao-nonce-monitor/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### Precise 8-Minute Intervals (if 1 slot/sec)
```bash
*/8 * * * * /usr/bin/node /path/to/ao-nonce-monitor/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

## Step-by-Step Setup

### 1. Determine Your Slot Timing

First, check the actual slot duration for your AO network:

```bash
# Query the current slot
curl https://state.forward.computer/YOUR_PROCESS_ID/compute/at-slot

# Wait and query again to measure slot progression
sleep 60
curl https://state.forward.computer/YOUR_PROCESS_ID/compute/at-slot

# Calculate slots per minute based on difference
```

### 2. Calculate Cron Interval

```bash
# Formula: 500 slots ÷ (slots per minute) = minutes between runs

# Example calculations:
# - 120 slots/min → 500 ÷ 120 ≈ 4.2 minutes → */4 or */5
# - 60 slots/min → 500 ÷ 60 ≈ 8.3 minutes → */8
# - 30 slots/min → 500 ÷ 30 ≈ 16.7 minutes → */17 or */15
```

### 3. Configure Environment Variables

Create a dedicated script wrapper for cron:

```bash
#!/bin/bash
# /path/to/run-nonce-monitor.sh

# Load environment variables
export PROCESS_ID="0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc"
export REQUEST_TIMEOUT=10000
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Or load from .env file
# export $(grep -v '^#' /path/to/.env | xargs)

# Run monitor
/usr/bin/node /path/to/ao-nonce-monitor/nonce-monitor.js
```

Make it executable:
```bash
chmod +x /path/to/run-nonce-monitor.sh
```

### 4. Set Up Cron Job

Edit crontab:
```bash
crontab -e
```

Add one of these entries:

#### Option A: Using wrapper script (recommended)
```bash
# Every 5 minutes (500 slots assuming 2 slots/sec)
*/5 * * * * /path/to/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1
```

#### Option B: Inline environment variables
```bash
# Every 5 minutes with inline config
*/5 * * * * PROCESS_ID=your-id SLACK_WEBHOOK_URL=your-webhook /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

#### Option C: Multi-process config file
```bash
# Every 5 minutes using process-ids.txt
*/5 * * * * CONFIG_FILE=/path/to/process-ids.txt /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### 5. Set Up Log Rotation

Create log rotation config:
```bash
sudo nano /etc/logrotate.d/nonce-monitor
```

Add:
```
/var/log/nonce-monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 your-user your-group
}
```

### 6. Verify Cron Job

```bash
# List current cron jobs
crontab -l

# Check cron is running
sudo systemctl status cron  # or crond on some systems

# Monitor the log file
tail -f /var/log/nonce-monitor.log
```

## Advanced: Slot-Synchronized Execution

For precise slot synchronization, create a slot-aware wrapper:

```bash
#!/bin/bash
# /path/to/slot-aware-monitor.sh

# Get current slot
CURRENT_SLOT=$(curl -s https://state.forward.computer/$PROCESS_ID/compute/at-slot)

# Calculate if we should run (every 500 slots)
REMAINDER=$((CURRENT_SLOT % 500))

# Only run if at a 500-slot boundary (with tolerance)
if [ $REMAINDER -lt 5 ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)] Running at slot $CURRENT_SLOT"
    /usr/bin/node /path/to/nonce-monitor.js
else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)] Skipping - not at 500-slot boundary (slot $CURRENT_SLOT, remainder $REMAINDER)"
fi
```

Then run this script every minute:
```bash
# Run every minute, script decides if it's a 500-slot boundary
* * * * * /path/to/slot-aware-monitor.sh >> /var/log/nonce-monitor.log 2>&1
```

## Monitoring Cron Execution

### Check Last Run
```bash
# View recent executions
tail -20 /var/log/nonce-monitor.log
```

### Check Cron Logs
```bash
# System cron log
grep CRON /var/log/syslog | tail -20

# Or on some systems
sudo journalctl -u cron | tail -20
```

### Verify Timing
```bash
# Check execution frequency
grep "SUMMARY" /var/log/nonce-monitor.log | tail -10
```

## Example Cron Schedules

### Conservative (Every 5 Minutes)
```bash
# Runs 12 times per hour, 288 times per day
*/5 * * * * /path/to/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1
```

### Precise (Every 4 Minutes and 10 Seconds)
```bash
# Closer to 500 slots if 2 slots/sec
*/4 * * * * /path/to/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1
0-56/4 * * * * sleep 10 && /path/to/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1
```

### Custom Intervals
```bash
# Every 8 minutes (if 1 slot/sec)
*/8 * * * * /path/to/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1

# Every 15 minutes (if 0.5 slots/sec)
*/15 * * * * /path/to/run-nonce-monitor.sh >> /var/log/nonce-monitor.log 2>&1
```

## Troubleshooting

### Cron Not Running
```bash
# Check cron service
sudo systemctl status cron

# Restart if needed
sudo systemctl restart cron
```

### Script Not Executing
```bash
# Check file permissions
ls -l /path/to/run-nonce-monitor.sh

# Make executable
chmod +x /path/to/run-nonce-monitor.sh

# Check Node.js path
which node
# Update cron to use full path: /usr/bin/node
```

### No Log Output
```bash
# Check log file permissions
ls -l /var/log/nonce-monitor.log

# Create log file if missing
touch /var/log/nonce-monitor.log
chmod 644 /var/log/nonce-monitor.log
```

### Environment Variables Not Working
```bash
# Verify environment in wrapper script
echo "PROCESS_ID=$PROCESS_ID" >> /var/log/nonce-monitor.log

# Or use absolute path to .env
export $(cat /absolute/path/to/.env | grep -v '^#' | xargs)
```

## Production Checklist

- [ ] Determined actual slot timing for your network
- [ ] Calculated correct cron interval (500 slots)
- [ ] Created wrapper script with environment variables
- [ ] Made wrapper script executable
- [ ] Added cron job to crontab
- [ ] Configured log rotation
- [ ] Verified cron is running
- [ ] Monitored first few executions
- [ ] Set up Slack alerts (optional)
- [ ] Documented deployment in team wiki

## Quick Reference

| Slot Speed | 500 Slots | Cron Schedule |
|------------|-----------|---------------|
| 2 slots/sec | ~4.2 min | `*/4 * * * *` or `*/5 * * * *` |
| 1 slot/sec | ~8.3 min | `*/8 * * * *` |
| 0.5 slots/sec | ~16.7 min | `*/15 * * * *` or `*/17 * * * *` |
| 4 slots/sec | ~2.1 min | `*/2 * * * *` |

## Summary

1. **Determine your slot timing** (query endpoint twice, measure difference)
2. **Calculate interval:** 500 slots ÷ (slots per minute) = minutes
3. **Create wrapper script** with environment variables
4. **Add to crontab** with calculated interval
5. **Set up log rotation** to manage log files
6. **Monitor and verify** first few runs

For most AO networks, **`*/5 * * * *` (every 5 minutes)** is a safe starting point.
