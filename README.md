# Nonce Monitor

A lightweight monitoring script that validates nonce synchronization between AO network endpoints. This tool periodically checks that state values remain consistent across different services in the AO network infrastructure.

## Features

- **Dual-Endpoint Monitoring**: Compares nonce values from state and SU router endpoints
- **Multi-Process Monitoring**: Monitor multiple processes from a configuration file
- **Aggregated Summary Reporting**: Get consolidated results across all monitored processes
- **Slack notifications for nonce mismatches**: Get real-time alerts in Slack when mismatches are detected
- **Batched alerts for multi-process monitoring**: Receive consolidated Slack alerts for multiple processes
- **Automated Validation**: Detects synchronization mismatches in real-time
- **Zero Dependencies**: Uses native Node.js fetch API (Node.js 18+)
- **Resilient Error Handling**: Gracefully handles network failures, timeouts, and malformed responses
- **Configurable Timeouts**: Adjustable request timeout settings
- **Multi-Process Support**: Monitor any AO network process by ID
- **Production-Ready Logging**: ISO 8601 timestamps with clear MATCH/MISMATCH indicators
- **Cron-Compatible**: Designed for system cron scheduling

## Requirements

- **Node.js**: v18.0.0 or higher (for native fetch API support)

## Configuration Modes

The Nonce Monitor supports two distinct operating modes:

### Single-Process Mode

Monitor a single process by setting the `PROCESS_ID` environment variable. This mode is ideal for:
- Quick one-off checks
- Monitoring a single critical process
- Testing and debugging
- Simple deployment scenarios

### Multi-Process Mode

Monitor multiple processes simultaneously from a configuration file. This mode is ideal for:
- Production deployments with multiple processes
- Centralized monitoring of all your AO processes
- Consolidated reporting across your infrastructure
- Reduced cron job complexity (one job monitors everything)

**Mode Selection**: The monitor automatically selects the mode based on:
1. If a config file exists at `CONFIG_FILE` path (or default `./process-ids.txt`), multi-process mode is used
2. Otherwise, falls back to single-process mode using `PROCESS_ID` environment variable

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd nonce-monitor
   ```

2. **Configure environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. **Make the script executable** (optional):
   ```bash
   chmod +x nonce-monitor.js
   ```

## Configuration File

### Location and Format

The configuration file allows you to specify multiple process IDs to monitor. By default, the monitor looks for `process-ids.txt` in the current directory.

**File Format:**
- One process ID per line
- Lines starting with `#` are treated as comments
- Empty lines are ignored
- Leading and trailing whitespace is trimmed

### Example Configuration

Create a file named `process-ids.txt`:

```
# Production processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc

# Staging environment
abc123xyz456def789ghi012jkl345mno678pqr901stu

# Testing process
test-process-id-1234567890

# This is a comment - the next line is empty and will be skipped

# Another process
xyz789abc123def456ghi789jkl012mno345pqr678stu
```

### Custom Configuration Path

You can specify a custom configuration file path using the `CONFIG_FILE` environment variable:

```bash
CONFIG_FILE=/path/to/custom-processes.txt node nonce-monitor.js
```

## Configuration

The script can be configured using environment variables:

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CONFIG_FILE` | Path to process IDs configuration file | `./process-ids.txt` | No |
| `PROCESS_ID` | AO network process ID (single-process mode) | None | No* |
| `REQUEST_TIMEOUT` | HTTP request timeout in milliseconds | `10000` (10 seconds) | No |
| `SLACK_WEBHOOK_URL` | Slack webhook URL for sending alerts | None | No |
| `SLACK_ALERT_ON_ERROR` | Send Slack alerts for errors (not just mismatches) | `false` | No |

**Configuration Precedence:**
1. If config file exists at `CONFIG_FILE` path → multi-process mode (ignores `PROCESS_ID`)
2. If no config file exists → single-process mode using `PROCESS_ID`
3. If neither exists → error

\* `PROCESS_ID` is required only when operating in single-process mode (no config file present)

### Monitored Endpoints

The script monitors two endpoints for each process ID:

1. **State Endpoint**: `https://state.forward.computer/{PROCESS_ID}/compute/at-slot`
   - Returns plain text nonce value

2. **SU Router Endpoint**: `https://su-router.ao-testnet.xyz/{PROCESS_ID}/latest`
   - Returns JSON with nonce in `assignment.tags[]` array (where `name === "Nonce"`)

## Slack Integration

The Nonce Monitor can send real-time alerts to Slack when nonce mismatches are detected. This feature is particularly useful for production monitoring and allows teams to respond quickly to synchronization issues.

### Overview

- **Automatic Alerts**: Alerts are automatically sent when nonce mismatches are detected
- **Batched Notifications**: In multi-process mode, multiple mismatches are consolidated into a single Slack message for cleaner notification management
- **Optional Error Alerts**: Can be configured to also alert on errors (network failures, timeouts, etc.)
- **Non-Blocking**: Slack notification failures won't prevent the monitor from completing its checks

### When Alerts Are Sent

Slack alerts are triggered in the following scenarios:

1. **Nonce Mismatches**: When state and SU router nonces don't match (always sent)
2. **Errors** (optional): When `SLACK_ALERT_ON_ERROR=true`, errors like timeouts or parsing failures will also trigger alerts

**Note**: Successful matches (when nonces are in sync) do not trigger Slack notifications to reduce noise.

### Batched vs. Immediate Alerts

- **Multi-Process Mode**: All mismatches detected in a single run are batched into one consolidated Slack message
- **Single-Process Mode**: Alerts are sent immediately when a mismatch is detected

### Slack Configuration

To enable Slack notifications, you need to configure a webhook URL:

1. **Set the SLACK_WEBHOOK_URL environment variable**:
   ```bash
   export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

2. **How to get a webhook URL**:
   - See [SLACK_SETUP.md](SLACK_SETUP.md) for detailed instructions on creating a Slack webhook
   - Requires admin access to your Slack workspace
   - Create an Incoming Webhook in your Slack App settings

3. **Optional: Enable error alerts**:
   ```bash
   export SLACK_ALERT_ON_ERROR=true
   ```

**Example Configuration**:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
SLACK_ALERT_ON_ERROR=true
```

For detailed setup instructions, see [SLACK_SETUP.md](SLACK_SETUP.md).

## Usage

### Quick Setup with Slack

Get started quickly with Slack notifications enabled:

```bash
# 1. Get Slack webhook URL (see SLACK_SETUP.md)
# 2. Add to environment
export SLACK_WEBHOOK_URL=your-webhook-url
# 3. Run monitor
node nonce-monitor.js
```

### Multi-Process Monitoring

Monitor all processes defined in `process-ids.txt`:

```bash
node nonce-monitor.js
```

Monitor processes from a custom configuration file:

```bash
CONFIG_FILE=./production-processes.txt node nonce-monitor.js
```

Monitor processes with custom timeout:

```bash
REQUEST_TIMEOUT=30000 node nonce-monitor.js
```

With Slack alerts enabled:

```bash
SLACK_WEBHOOK_URL=your-webhook-url node nonce-monitor.js
```

### Single-Process Monitoring

Monitor a single process (when no config file exists):

```bash
PROCESS_ID=your-process-id-here node nonce-monitor.js
```

With custom timeout:

```bash
PROCESS_ID=abc123xyz REQUEST_TIMEOUT=30000 node nonce-monitor.js
```

With Slack alerts enabled:

```bash
SLACK_WEBHOOK_URL=your-webhook-url PROCESS_ID=your-process-id-here node nonce-monitor.js
```

### Expected Output

**Multi-Process Mode:**
```
[2025-01-03T10:00:00.123Z] [0syT13r0...LLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:00:01.234Z] [abc123xy...r901stu] State Nonce: 1523456 | SU Router Nonce: 1523456 | Status: MATCH ✓
[2025-01-03T10:00:02.345Z] [test-pro...1234567] State Nonce: 9876543 | SU Router Nonce: 9876542 | Status: MISMATCH ✗

=== SUMMARY ===
Total Processes: 3
Matches: 2 ✓
Mismatches: 1 ✗
Errors: 0 ⚠
```

**Single-Process Mode:**
```
[2025-01-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
```

**With Slack Enabled:**
```
[2025-01-03T10:00:00.123Z] [0syT13r0...LLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:00:01.234Z] [abc123xy...r901stu] State Nonce: 1523456 | SU Router Nonce: 1523457 | Status: MISMATCH ✗
[2025-01-03T10:00:02.345Z] Slack alert sent successfully

=== SUMMARY ===
Total Processes: 2
Matches: 1 ✓
Mismatches: 1 ✗
Errors: 0 ⚠
```

### With Environment File

Using a `.env` file (requires manual export):

```bash
export $(cat .env | xargs) && node nonce-monitor.js
```

## Slack Message Examples

When Slack integration is enabled, the monitor sends formatted alerts for nonce mismatches and errors.

### Single Mismatch Alert

```
🚨 Nonce Mismatch Alert

Process: 0syT13r0...LLSrsc
State Nonce: 2205625
SU Router Nonce: 2205624
Timestamp: 2025-01-03T10:00:00.123Z
```

### Multiple Mismatches Alert (Batched)

```
🚨 Nonce Mismatch Alert - Multiple Processes

⚠️ Process: 0syT13r0...LLSrsc
State Nonce: 2205625
SU Router Nonce: 2205624

⚠️ Process: abc123xy...r901stu
State Nonce: 1523456
SU Router Nonce: 1523457

⚠️ Process: test-pro...1234567
State Nonce: 9876543
SU Router Nonce: 9876541

Total Mismatches: 3
Timestamp: 2025-01-03T10:00:05.789Z
```

### Message Format

Each Slack alert includes:
- **Process ID**: Truncated format (first8...last8) for readability
- **State Nonce**: The nonce value from the state endpoint
- **SU Router Nonce**: The nonce value from the SU router endpoint
- **Timestamp**: ISO 8601 formatted timestamp of when the mismatch was detected
- **Batch Count**: For multi-process alerts, shows total number of mismatches in the batch

## Multi-Process Output

### Process ID Truncation

To keep log output readable, long process IDs are automatically truncated in the format `first8...last8`. For example:

- Full ID: `0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc`
- Displayed: `[0syT13r0...LLSrsc]`

Process IDs under 20 characters are displayed in full.

### Summary Format

After checking all processes, a summary is displayed:

```
=== SUMMARY ===
Total Processes: 5
Matches: 3 ✓
Mismatches: 1 ✗
Errors: 1 ⚠
```

**Summary Components:**
- **Total Processes**: Number of process IDs in the configuration
- **Matches**: Processes where state and SU router nonces match
- **Mismatches**: Processes where nonces differ
- **Errors**: Processes that encountered errors (network, parsing, etc.)

### Exit Codes

**Multi-Process Mode:**
- `0`: All processes matched successfully (no mismatches or errors)
- `1`: One or more processes had mismatches or errors

**Single-Process Mode:**
- `0`: Nonces fetched and compared successfully
- `1`: Error occurred during fetch or comparison

## Log Output Examples

### Multi-Process Examples

**All Processes Matching:**
```
[2025-01-03T10:00:00.123Z] [0syT13r0...LLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:00:01.456Z] [abc123xy...r901stu] State Nonce: 1523456 | SU Router Nonce: 1523456 | Status: MATCH ✓
[2025-01-03T10:00:02.789Z] [xyz789ab...r678stu] State Nonce: 9876543 | SU Router Nonce: 9876543 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 3
Matches: 3 ✓
Mismatches: 0 ✗
Errors: 0 ⚠
```

**Mixed Results (Matches, Mismatches, Errors):**
```
[2025-01-03T10:00:00.123Z] [0syT13r0...LLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:00:01.456Z] [abc123xy...r901stu] State Nonce: 1523456 | SU Router Nonce: 1523457 | Status: MISMATCH ✗
[2025-01-03T10:00:02.789Z] [test-pro...1234567] ERROR: Failed to fetch state nonce: Request timeout after 10000ms
[2025-01-03T10:00:03.012Z] [xyz789ab...r678stu] State Nonce: 9876543 | SU Router Nonce: 9876543 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 4
Matches: 2 ✓
Mismatches: 1 ✗
Errors: 1 ⚠
```

### Single-Process Examples

**Successful Match:**
```
[2025-01-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
```

**Synchronization Mismatch:**
```
[2025-01-03T10:10:00.789Z] State Nonce: 2205628 | SU Router Nonce: 2205627 | Status: MISMATCH ✗
```

**Network Error:**
```
[2025-01-03T10:15:00.012Z] ERROR: Failed to fetch state nonce: Request timeout after 10000ms
```

**JSON Parsing Error:**
```
[2025-01-03T10:20:00.345Z] ERROR: Failed to parse JSON from SU Router: Unexpected token < in JSON at position 0
```

## Migration from Single to Multi-Process

### Step-by-Step Migration Guide

If you're currently using single-process mode with cron jobs and want to migrate to multi-process mode:

1. **Create the configuration file:**
   ```bash
   # Create process-ids.txt in your project directory
   cd /path/to/nonce-monitor
   touch process-ids.txt
   ```

2. **Add your process IDs:**
   ```bash
   # Edit process-ids.txt and add your process IDs
   nano process-ids.txt
   ```

   Example content:
   ```
   # My production processes
   0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc
   abc123xyz456def789ghi012jkl345mno678pqr901stu
   ```

3. **Test the configuration:**
   ```bash
   # Run manually to verify configuration
   node nonce-monitor.js
   
   # Should see output for all processes with summary
   ```

4. **Update your cron job:**
   
   **Before (multiple cron jobs):**
   ```bash
   */5 * * * * PROCESS_ID=process-1 /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   */5 * * * * PROCESS_ID=process-2 /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   */5 * * * * PROCESS_ID=process-3 /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   ```
   
   **After (single cron job):**
   ```bash
   */5 * * * * cd /path/to/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   ```

5. **Verify the migration:**
   ```bash
   # Check the log file after the cron job runs
   tail -f /var/log/nonce-monitor.log
   ```

### Benefits of Migration

- **Simplified Cron Management**: One cron job instead of many
- **Consolidated Reporting**: Single summary for all processes
- **Easier Maintenance**: Add/remove processes by editing one file
- **Better Performance**: Parallelizable checks with shared resources
- **Clearer Logs**: All related checks grouped together with summary

## Cron Setup

The script is designed for one-shot execution, making it ideal for system cron scheduling.

### Basic Cron Configuration

Add to your crontab (`crontab -e`):

**Multi-Process Mode:**
```bash
# Run every 5 minutes for all processes
*/5 * * * * cd /path/to/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Run every minute
* * * * * cd /path/to/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

**Single-Process Mode:**
```bash
# Run every 5 minutes
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Run every minute
* * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Run every 15 minutes
*/15 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### With Environment Variables

```bash
# Single-process with custom settings
*/5 * * * * PROCESS_ID=custom-id REQUEST_TIMEOUT=30000 /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1

# Multi-process with custom config file
*/5 * * * * CONFIG_FILE=/etc/nonce-monitor/processes.txt /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

### Log Rotation

Prevent log file growth with logrotate (`/etc/logrotate.d/nonce-monitor`):

```
/var/log/nonce-monitor.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

## Error Handling

The script implements comprehensive error handling for production reliability:

### Network Errors
- **Timeout Errors**: Aborts requests exceeding `REQUEST_TIMEOUT`
- **HTTP Errors**: Handles non-200 status codes with descriptive messages
- **Connection Failures**: Catches and reports network connectivity issues

### Parsing Errors
- **JSON Parsing**: Validates JSON structure and reports syntax errors
- **Missing Fields**: Checks for required fields in API responses
- **Empty Responses**: Detects and reports empty or invalid nonce values

### Response Validation
- **Data Structure**: Validates expected response format from both endpoints
- **Type Safety**: Ensures nonce values are properly converted to strings for comparison
- **Null/Undefined Checks**: Handles missing or null values gracefully

### Exit Codes

**Single-Process Mode:**
- `0`: Successful execution (nonces fetched and compared)
- `1`: Error occurred (logged to stderr)

**Multi-Process Mode:**
- `0`: All processes checked successfully with no mismatches or errors
- `1`: One or more processes had errors or mismatches

## Troubleshooting

### Common Issues

**Issue**: Script fails with "fetch is not defined"
```
Solution: Upgrade to Node.js v18.0.0 or higher
  node --version  # Check current version
  nvm install 18  # Install Node.js 18+
```

**Issue**: Request timeout errors
```
Solution: Increase REQUEST_TIMEOUT value
  REQUEST_TIMEOUT=30000 node nonce-monitor.js
```

**Issue**: "Nonce tag not found in assignment.tags"
```
Possible causes:
  - API response structure changed
  - Invalid process ID
  - Process has no nonce data
  
Check the raw API response:
  curl https://su-router.ao-testnet.xyz/{PROCESS_ID}/latest
```

**Issue**: Cron job not executing
```
Solution: Check cron logs and verify paths
  grep CRON /var/log/syslog  # Check cron execution
  which node                  # Verify Node.js path
  # Use absolute paths in crontab
```

**Issue**: Mismatches appearing frequently
```
This may indicate:
  - Legitimate synchronization lag between services
  - Network timing issues causing race conditions
  
Investigate by:
  - Checking mismatch patterns (always off by 1?)
  - Reviewing AO network status
  - Reducing check interval to capture transition states
```

**Issue**: Slack alerts not working
```
Solutions:
  1. Check webhook URL is set:
     echo $SLACK_WEBHOOK_URL
     
  2. Check webhook URL is valid:
     - Should start with https://hooks.slack.com/services/
     - Test manually with curl:
       curl -X POST -H 'Content-type: application/json' \
         --data '{"text":"Test message"}' \
         $SLACK_WEBHOOK_URL
     
  3. Check Slack workspace permissions:
     - Ensure the webhook is still active in Slack App settings
     - Verify the app has permission to post to the channel
     
  4. Check script logs for Slack errors:
     - Look for "Failed to send Slack alert" messages
     - Check for network connectivity issues
```

**Issue**: Slack webhook timeout
```
Solutions:
  - Slack webhook requests have a 3-second timeout
  - If timeouts occur frequently:
    1. Check network connectivity to Slack
    2. Verify no firewall blocking outbound HTTPS
    3. Slack notification failures won't stop the monitor
    4. Check Slack service status: https://status.slack.com
```

**Issue**: Config file not found
```
Error: Config file not found: ./process-ids.txt

Solutions:
  1. Create the config file:
     touch process-ids.txt
     
  2. Specify custom path:
     CONFIG_FILE=/path/to/your/config.txt node nonce-monitor.js
     
  3. Use single-process mode:
     PROCESS_ID=your-process-id node nonce-monitor.js
```

**Issue**: Empty config file or no valid process IDs
```
Error: No valid process IDs found in config file

Solutions:
  1. Add at least one valid process ID to the config file
  2. Check for typos in process IDs
  3. Ensure process IDs are not commented out with #
  4. Verify file encoding (should be UTF-8)
```

**Issue**: Invalid process IDs in config file
```
Warning: Invalid process ID on line 5: ""

Solutions:
  - Remove empty lines between process IDs (or leave them, they're ignored)
  - Ensure each process ID is on its own line
  - Check for special characters or whitespace issues
  - The monitor will skip invalid lines and continue
```

**Issue**: Performance with many processes
```
If monitoring 50+ processes:
  - Increase REQUEST_TIMEOUT for slower networks
  - Consider splitting into multiple config files
  - Run different groups at different intervals
  - Monitor execution time in logs
  
Example split strategy:
  # Critical processes - check every minute
  */1 * * * * CONFIG_FILE=critical.txt node nonce-monitor.js
  
  # Regular processes - check every 5 minutes  
  */5 * * * * CONFIG_FILE=regular.txt node nonce-monitor.js
```

## Architecture

This is a standalone monitoring script with a simple architecture:

### Design Principles
- **Stateless**: Each execution is independent
- **Fail-Fast**: Exits immediately on errors with non-zero status
- **Minimal Dependencies**: Uses only Node.js built-in modules
- **Defensive Parsing**: Validates all external data

### Execution Flow

**Multi-Process Mode:**
1. Load and parse configuration file
2. Validate process IDs
3. Check each process sequentially
4. Log individual results
5. Generate and display summary
6. Exit with appropriate status code

**Single-Process Mode:**
1. Parse environment variables and construct endpoint URLs
2. Fetch both endpoints in parallel using `Promise.all()`
3. Extract and validate nonce values from responses
4. Compare nonces (type-safe string comparison)
5. Log result with timestamp
6. Exit with appropriate status code

### Key Components

**`loadConfig(filePath)`**
- Reads configuration file from disk
- Parses process IDs (one per line)
- Filters comments (lines starting with `#`)
- Validates and returns array of process IDs

**`truncateProcessId(processId)`**
- Truncates long process IDs for readable logging
- Format: `first8...last8` (e.g., `0syT13r0...LLSrsc`)
- Shows full ID if under 20 characters

**`checkProcess(processId)`**
- Monitors a single process
- Fetches from both endpoints in parallel
- Returns result object with nonces and status

**`checkAllProcesses(processIds)`**
- Iterates through all configured processes
- Logs results for each process
- Returns array of all results

**`generateSummary(results)`**
- Aggregates results across all processes
- Displays match/mismatch/error counts
- Returns appropriate exit code

**`fetchWithTimeout(url, timeout)`**
- Wraps native fetch with AbortController for timeout support
- Validates HTTP response status
- Throws descriptive errors for debugging

**`fetchStateNonce()`**
- Fetches plain text nonce from state endpoint
- Trims whitespace and validates non-empty response

**`fetchSURouterNonce()`**
- Fetches JSON from SU router endpoint
- Navigates to `assignment.tags[]` array
- Finds tag where `name === "Nonce"`
- Extracts and returns `value` field

**`logResult(processId, stateNonce, suRouterNonce)`**
- Performs string comparison for type safety
- Outputs formatted log with MATCH/MISMATCH status
- Includes truncated process ID in multi-process mode

## License

MIT
