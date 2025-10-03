# Migration Guide: Single-Process to Multi-Process Monitoring

This guide walks you through upgrading your nonce monitor from single-process mode (using `PROCESS_ID` environment variable) to multi-process mode (using `process-ids.txt` config file).

---

## 1. Overview

### What's Changing

The nonce monitor now supports two operating modes:

- **Single-Process Mode** (legacy): Monitor one process via `PROCESS_ID` environment variable
- **Multi-Process Mode** (new): Monitor multiple processes via `process-ids.txt` config file

The script automatically detects which mode to use based on whether `process-ids.txt` exists.

### Benefits of Multi-Process Mode

- **Monitor multiple AO processes** from a single cron job
- **Centralized configuration** - no need to manage multiple environment variables
- **Batch execution summary** - see aggregate results across all processes
- **Better scalability** - easily add/remove processes by editing one file

### Backward Compatibility

✅ **Existing single-process setups continue to work without changes**

If `process-ids.txt` doesn't exist, the script falls back to `PROCESS_ID` mode automatically. You can migrate at your own pace.

---

## 2. Pre-Migration Checklist

Before migrating, verify your current setup:

### ✅ Verify Current Setup Works

```bash
# Test your current single-process monitor
node nonce-monitor.js
```

Expected output:
```
[2025-01-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
```

### ✅ Document Current PROCESS_ID

```bash
# Save your current process ID
echo $PROCESS_ID
# Or check your cron configuration
crontab -l | grep nonce-monitor
```

### ✅ Check Node.js Version

```bash
node --version
# Should be v18.0.0 or higher
```

### ✅ Review Cron Configuration

```bash
# View your current cron setup
crontab -l
```

Note the schedule and any environment variables used.

---

## 3. Migration Steps

### Step 1: Create process-ids.txt from Template

```bash
cd /path/to/nonce-monitor
cp process-ids.example.txt process-ids.txt
```

### Step 2: Add Your Process ID(s)

Edit `process-ids.txt` with your favorite editor:

```bash
nano process-ids.txt
```

Add your process IDs (one per line):

```
# My AO Network Processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
abc123xyz789def456ghi012jkl345mno678pqr901s
```

**Tips:**
- Remove or comment out the example process ID
- Add one process ID per line
- Use `#` for comments
- Empty lines are ignored

### Step 3: Test Manually

Run the script to verify multi-process mode works:

```bash
node nonce-monitor.js
```

Expected output:
```
[2025-01-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:00:01.456Z] [abc123xy...r901s] State Nonce: 1500000 | SU Router Nonce: 1500000 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 2
Matches: 2 ✓
Mismatches: 0 ✗
Errors: 0 ⚠
```

### Step 4: Update Cron (if needed)

**Good news:** Your existing cron job should work without changes! The script now uses the config file instead of `PROCESS_ID`.

**Optional:** Remove `PROCESS_ID` from your cron line if it's there:

**Before:**
```bash
*/5 * * * * PROCESS_ID=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

**After:**
```bash
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

Edit crontab:
```bash
crontab -e
```

### Step 5: Monitor Initial Runs

Watch your logs to ensure the migration worked:

```bash
tail -f /var/log/nonce-monitor.log
```

Verify:
- ✅ All processes are being checked
- ✅ Summary appears at the end
- ✅ Timestamps are correct
- ✅ No unexpected errors

### Step 6: Remove PROCESS_ID Environment Variable (Optional)

Once you've verified everything works, you can remove `PROCESS_ID` from your environment:

```bash
# From .env file (if you're using one)
nano .env
# Remove or comment out PROCESS_ID line

# From shell profile (if you set it globally)
# Check ~/.bashrc, ~/.zshrc, or ~/.profile
```

**Note:** This step is optional. The `PROCESS_ID` environment variable is ignored when `process-ids.txt` exists.

---

## 4. Configuration Examples

### Single Process Migration (1 ID in Config File)

**process-ids.txt:**
```
# Production process
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
```

**Output:**
```
[2025-01-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 1
Matches: 1 ✓
Mismatches: 0 ✗
Errors: 0 ⚠
```

### Multiple Processes (2-10 IDs)

**process-ids.txt:**
```
# Production processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
abc123xyz789def456ghi012jkl345mno678pqr901s
xyz999aaa888bbb777ccc666ddd555eee444fff333

# Staging process
stage_1234567890abcdefghijklmnopqrstuvwxyz12
```

**Cron:**
```bash
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### Large Deployment (10+ IDs)

**process-ids.txt:**
```
# Production cluster
prod-node-01-0syT13r0s0tgPmIed95bJnuSqaD29HQNN
prod-node-02-abc123xyz789def456ghi012jkl345mno6
prod-node-03-xyz999aaa888bbb777ccc666ddd555eee4
# ... (10+ processes)
```

**Cron (consider less frequent checks):**
```bash
# Every 10 minutes for large deployments
*/10 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

**Consider:**
- Adjust cron interval based on number of processes (each check takes ~1-2 seconds)
- Monitor log file size and adjust log rotation accordingly

---

## 5. Testing Your Migration

### Manual Test Commands

```bash
# Test with config file
node nonce-monitor.js

# Test with custom config location
CONFIG_FILE=/path/to/custom-process-ids.txt node nonce-monitor.js

# Test legacy single-process mode (temporarily rename config)
mv process-ids.txt process-ids.txt.bak
PROCESS_ID=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc node nonce-monitor.js
mv process-ids.txt.bak process-ids.txt
```

### Expected Output Comparison

**Single-Process Mode (Legacy):**
```
[2025-01-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
```

**Multi-Process Mode (New):**
```
[2025-01-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:00:01.456Z] [abc123xy...r901s] State Nonce: 1500000 | SU Router Nonce: 1500000 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 2
Matches: 2 ✓
Mismatches: 0 ✗
Errors: 0 ⚠
```

### Validation Checklist

- [ ] Script runs without errors
- [ ] All process IDs are checked
- [ ] Process ID truncation works (shows first 8 + last 8 chars)
- [ ] Summary section appears
- [ ] Exit code is 0 for all matches
- [ ] Exit code is 1 for mismatches or errors
- [ ] Cron job executes on schedule
- [ ] Log file updates correctly

---

## 6. Rollback Procedure

### If Something Goes Wrong

**Option 1: Quick Rollback (Disable Multi-Process Mode)**

```bash
# Temporarily rename the config file
mv process-ids.txt process-ids.txt.disabled
```

The script will immediately fall back to single-process mode using `PROCESS_ID` environment variable.

**Option 2: Fix Config File Issues**

```bash
# Check for syntax errors or invalid IDs
cat process-ids.txt

# Validate process IDs (should be 43-character strings)
# Look for typos, missing characters, or invalid lines
```

**Option 3: Restore Original Cron**

```bash
# Edit crontab
crontab -e

# Restore original line with PROCESS_ID
*/5 * * * * PROCESS_ID=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Remove process-ids.txt
rm process-ids.txt
```

### How to Revert to Single-Process Mode

1. **Remove or rename config file:**
   ```bash
   rm process-ids.txt
   ```

2. **Ensure `PROCESS_ID` is set:**
   ```bash
   # In cron:
   */5 * * * * PROCESS_ID=your-id /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   
   # Or in .env:
   export PROCESS_ID=your-id
   ```

3. **Test:**
   ```bash
   PROCESS_ID=your-id node nonce-monitor.js
   ```

### Keep Both Modes Working During Transition

You can run both modes simultaneously for testing:

**Multi-process cron (hourly):**
```bash
0 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor-multi.log 2>&1
```

**Single-process cron (every 5 minutes):**
```bash
*/5 * * * * PROCESS_ID=your-id /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor-single.log 2>&1
```

Compare logs to verify both produce the same results.

---

## 7. Common Migration Issues

### Issue: Config File Not Found

**Error:**
```
[2025-01-03T10:00:00.000Z] ERROR: Config file not found: ./process-ids.txt
```

**Solution:**
```bash
# Ensure file exists in script directory
ls -la process-ids.txt

# Check file permissions
chmod 644 process-ids.txt

# Verify correct working directory in cron
cd /path/to/nonce-monitor && node nonce-monitor.js
```

### Issue: Process IDs Not Recognized

**Error:**
```
[2025-01-03T10:00:00.000Z] ERROR: No valid process IDs found in config file
```

**Solution:**
```bash
# Check for:
# - Empty file
# - All lines commented out
# - Invalid process ID format

# Valid process ID format: 43-character alphanumeric string
# Example: 0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc
```

**process-ids.txt should contain:**
```
# At least one valid process ID (uncommented)
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc
```

### Issue: Increased Execution Time

**Symptom:** Script takes longer to complete with multiple processes

**This is expected:** Each process is checked sequentially. Execution time = (number of processes) × (~1-2 seconds)

**Solutions:**
- Reduce check frequency in cron (e.g., every 10 minutes instead of 5)
- Monitor fewer processes per run
- Split into multiple config files if needed

### Issue: Log Volume Increase

**Symptom:** Log file grows faster with multi-process mode

**This is expected:** Each process generates at least one log line, plus a summary section

**Solutions:**

**Adjust log rotation (`/etc/logrotate.d/nonce-monitor`):**
```
/var/log/nonce-monitor.log {
    daily
    rotate 14          # Increase retention
    compress
    missingok
    notifempty
    size 10M           # Rotate at 10MB
}
```

**Monitor log size:**
```bash
du -h /var/log/nonce-monitor.log
```

---

## 8. Post-Migration Optimization

### Log Rotation Adjustment

With multi-process monitoring, logs grow faster. Update your log rotation config:

```bash
sudo nano /etc/logrotate.d/nonce-monitor
```

```
/var/log/nonce-monitor.log {
    daily                  # Rotate daily
    rotate 30              # Keep 30 days of logs
    compress               # Compress rotated logs
    delaycompress          # Don't compress most recent rotation
    missingok              # Don't error if log is missing
    notifempty             # Don't rotate empty logs
    size 50M               # Rotate if file exceeds 50MB
    postrotate
        # Optional: Send notification after rotation
        # /usr/local/bin/notify-rotation.sh
    endscript
}
```

Test rotation:
```bash
sudo logrotate -f /etc/logrotate.d/nonce-monitor
```

### Cron Interval Tuning

Choose appropriate intervals based on number of processes:

| Processes | Recommended Interval | Execution Time |
|-----------|---------------------|----------------|
| 1-3       | Every 5 minutes     | 2-6 seconds    |
| 4-10      | Every 10 minutes    | 4-20 seconds   |
| 11-20     | Every 15 minutes    | 11-40 seconds  |
| 21+       | Every 30 minutes    | 21+ seconds    |

Example cron schedules:
```bash
# Small deployment (1-3 processes)
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Medium deployment (4-10 processes)
*/10 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Large deployment (20+ processes)
*/30 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### Performance Monitoring

Monitor your nonce-monitor performance:

```bash
# Check execution time
time node nonce-monitor.js

# Monitor cron execution
grep nonce-monitor /var/log/syslog

# Check for missed cron runs (overlapping executions)
grep CRON /var/log/syslog | grep nonce-monitor

# Analyze log patterns
grep "SUMMARY" /var/log/nonce-monitor.log | tail -20
```

**Warning signs:**
- Executions taking longer than cron interval (overlapping runs)
- Frequent timeout errors
- Consistent mismatches across processes

**Optimizations:**
- Increase `REQUEST_TIMEOUT` for slow networks
- Reduce check frequency
- Split large process lists into separate config files

---

## 9. Frequently Asked Questions

### Can I use both modes?

**Yes!** You can keep using single-process mode by:
- Not creating `process-ids.txt`, OR
- Using a custom config location: `CONFIG_FILE=/other/path node nonce-monitor.js`

Both modes work simultaneously if you run separate cron jobs.

### Do I need to remove PROCESS_ID env var?

**No.** The `PROCESS_ID` environment variable is ignored when `process-ids.txt` exists. You can safely leave it in your environment or cron configuration.

However, removing it can prevent confusion in the future.

### How many processes can I monitor?

**Technical limit:** No hard limit, but practical considerations:

- Each process adds ~1-2 seconds execution time
- Cron interval should be longer than total execution time
- Log file size increases proportionally

**Recommendations:**
- **1-10 processes:** Works great with default settings
- **10-50 processes:** Adjust cron interval and log rotation
- **50+ processes:** Consider splitting into multiple config files or implementing parallel execution

### What about performance?

**Current implementation:** Sequential execution (one process at a time)

**Execution time:** Linear with number of processes
- 1 process = ~1-2 seconds
- 10 processes = ~10-20 seconds
- 50 processes = ~50-100 seconds

**Performance tips:**
- Monitor execution time: `time node nonce-monitor.js`
- Adjust cron interval to prevent overlapping runs
- Use `REQUEST_TIMEOUT` to fail fast on slow networks
- Consider splitting very large deployments

**Future optimization:** Parallel execution could be added if needed (not currently implemented).

### Can I monitor processes from different networks?

**Yes.** All processes use the same endpoints:
- `https://state.forward.computer/{PROCESS_ID}/compute/at-slot`
- `https://su-router.ao-testnet.xyz/{PROCESS_ID}/latest`

Just add all process IDs to `process-ids.txt`, regardless of their origin.

### What if I want different intervals for different processes?

Create multiple config files and cron jobs:

**process-ids-critical.txt:**
```
critical-process-1
critical-process-2
```

**process-ids-standard.txt:**
```
standard-process-1
standard-process-2
standard-process-3
```

**Cron:**
```bash
# Critical processes every 2 minutes
*/2 * * * * CONFIG_FILE=/path/to/process-ids-critical.txt /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor-critical.log 2>&1

# Standard processes every 15 minutes
*/15 * * * * CONFIG_FILE=/path/to/process-ids-standard.txt /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor-standard.log 2>&1
```

### How do I add/remove processes?

Simply edit `process-ids.txt`:

```bash
nano process-ids.txt
```

Changes take effect on the next cron run. No restart needed.

### Does this affect my existing logs?

**Log format changes:**
- **Single-process mode:** No process ID prefix
- **Multi-process mode:** Process ID prefix + summary section

**Example:**
```diff
- [2025-01-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
+ [2025-01-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
+ [2025-01-03T10:00:01.456Z] [abc123xy...r901s] State Nonce: 1500000 | SU Router Nonce: 1500000 | Status: MATCH ✓
+ 
+ === SUMMARY ===
+ Total Processes: 2
+ Matches: 2 ✓
+ Mismatches: 0 ✗
+ Errors: 0 ⚠
```

If you parse logs programmatically, update your parser to handle both formats.

---

## Need Help?

If you encounter issues during migration:

1. **Check the troubleshooting section** in the main README
2. **Review your config file** for syntax errors
3. **Test manually** before updating cron
4. **Check logs** for specific error messages
5. **Roll back** if needed (see Section 6)

**Migration support:** Open an issue in the repository with:
- Your current setup (single/multi-process)
- Error messages (if any)
- Config file contents (redact sensitive IDs if needed)
- Node.js version and platform

---

**Happy monitoring! 🚀**
