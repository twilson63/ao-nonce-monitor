# Project Request Protocol: Slack Alerting for Nonce Mismatches

## Project Overview

### Purpose
Enhance the AO Network Nonce Monitor to automatically send Slack notifications when nonce values don't match between the state endpoint and SU Router endpoint, enabling real-time alerting for synchronization issues.

### Background
The current monitoring system logs nonce mismatches to stdout/files but requires manual log review to detect issues. Production environments need immediate notification when synchronization problems occur. This enhancement will:
- Detect nonce mismatches in real-time
- Send formatted Slack messages with mismatch details
- Support both single-process and multi-process modes
- Maintain the zero-dependency philosophy (use native HTTPS, no Slack SDK)
- Provide configurable alerting thresholds

### Current State
**Existing Behavior:**
- Script checks nonce values from two endpoints
- Logs matches and mismatches to stdout
- Exits with code 0 (match) or 1 (mismatch/error)
- No external notifications

**Enhancement Needed:**
- Slack webhook integration for mismatch notifications
- Formatted message with process ID, nonce values, timestamp
- Optional: Alert on errors as well
- Optional: Threshold-based alerting (alert only after N consecutive failures)
- Configurable via environment variables

### Success Indicators
- Slack message sent when nonce mismatch detected
- Message includes all relevant details (process ID, nonces, timestamp)
- Configuration via environment variable (webhook URL)
- Works in both single and multi-process modes
- Maintains zero external dependencies
- Graceful degradation if Slack unavailable
- Optional batching for multi-process (one message with all mismatches)

---

## Technical Requirements

### Functional Requirements

1. **Slack Webhook Integration**
   - Use Slack Incoming Webhooks (no OAuth complexity)
   - POST JSON payload to webhook URL
   - Use native Node.js HTTPS (no external libraries)
   - Handle webhook errors gracefully

2. **Mismatch Detection**
   - Detect when stateNonce !== suRouterNonce
   - Trigger Slack notification on mismatch
   - Optional: Also alert on fetch errors
   - Optional: Alert only after N consecutive mismatches

3. **Message Formatting**
   - Include process ID (or truncated version)
   - Include both nonce values (state and SU Router)
   - Include timestamp (ISO 8601)
   - Include status (MISMATCH)
   - Optional: Link to monitoring dashboard
   - Optional: Color coding (red for mismatch)

4. **Configuration**
   - `SLACK_WEBHOOK_URL` environment variable (required for alerts)
   - Optional: `SLACK_ALERT_ON_ERROR` (default: false)
   - Optional: `SLACK_ALERT_THRESHOLD` (alert after N failures, default: 1)
   - Optional: `SLACK_BATCH_ALERTS` (batch multi-process alerts, default: false)

5. **Error Handling**
   - Slack webhook failure doesn't stop script execution
   - Log Slack errors to stderr
   - Timeout for Slack webhook requests (5-10 seconds)
   - Retry logic optional (simple approach: fail and log)

6. **Multi-Process Support**
   - Option 1: Send one message per mismatch
   - Option 2: Batch all mismatches into one summary message
   - Configurable via environment variable

### Non-Functional Requirements

- **Performance**: Slack webhook call shouldn't significantly delay execution (< 5s)
- **Dependencies**: Zero external dependencies (use native HTTPS)
- **Reliability**: Script succeeds even if Slack fails
- **Security**: Webhook URL stored in environment variable (not hardcoded)
- **Testability**: Easy to test without actually sending to Slack

### Constraints

- Must work with existing Node.js runtime (18+)
- No external dependencies (no `@slack/webhook` or `axios`)
- Must not break existing functionality
- Slack webhook URL must be kept secret (env var only)
- Must remain cron-compatible (no long-running processes)

---

## Proposed Solutions

### Solution 1: Immediate Alerts with Native HTTPS

**Description**: Send a Slack message immediately when a mismatch is detected using Node.js native `https` module.

**Implementation Approach**:
```javascript
const https = require('https');

async function sendSlackAlert(processId, stateNonce, suRouterNonce) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // Skip if not configured
  
  const message = {
    text: `🚨 Nonce Mismatch Detected`,
    attachments: [{
      color: 'danger',
      fields: [
        { title: 'Process ID', value: processId, short: true },
        { title: 'State Nonce', value: stateNonce, short: true },
        { title: 'SU Router Nonce', value: suRouterNonce, short: true },
        { title: 'Timestamp', value: new Date().toISOString(), short: true }
      ]
    }]
  };
  
  const payload = JSON.stringify(message);
  const url = new URL(webhookUrl);
  
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      if (res.statusCode === 200) resolve();
      else reject(new Error(`Slack webhook failed: ${res.statusCode}`));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Slack webhook timeout'));
    });
    req.write(payload);
    req.end();
  });
}
```

**Pros**:
- ✅ Zero dependencies (native HTTPS module)
- ✅ Immediate notification (real-time alerts)
- ✅ Simple implementation
- ✅ Works with Slack Incoming Webhooks
- ✅ Easy to understand and maintain
- ✅ Timeout support for reliability
- ✅ Clean separation (alert function is independent)

**Cons**:
- ❌ Multiple Slack messages in multi-process mode (can be noisy)
- ❌ No built-in retry logic (fails once and logs)
- ❌ Requires manual webhook setup in Slack
- ❌ More verbose than using a library (but acceptable)
- ❌ No rate limiting (could hit Slack limits with many processes)

---

### Solution 2: Batched Alerts with Summary

**Description**: Collect all mismatches during execution and send a single summary message at the end.

**Implementation Approach**:
```javascript
const mismatches = [];

async function checkProcess(processId) {
  // ... existing check logic ...
  
  if (stateNonce !== suRouterNonce) {
    mismatches.push({ processId, stateNonce, suRouterNonce });
  }
}

async function sendBatchedSlackAlert(mismatches) {
  if (mismatches.length === 0) return;
  
  const message = {
    text: `🚨 ${mismatches.length} Nonce Mismatch(es) Detected`,
    attachments: mismatches.map(m => ({
      color: 'danger',
      fields: [
        { title: 'Process ID', value: m.processId, short: true },
        { title: 'State', value: m.stateNonce, short: true },
        { title: 'SU Router', value: m.suRouterNonce, short: true }
      ]
    }))
  };
  
  // Send via HTTPS (same as Solution 1)
}
```

**Pros**:
- ✅ Single message for multi-process (less noise)
- ✅ Summary view of all issues
- ✅ Reduces Slack API calls
- ✅ Better for rate limiting
- ✅ Easier to review (one notification vs many)
- ✅ Still zero dependencies

**Cons**:
- ❌ Delayed notification (wait until all checks complete)
- ❌ More complex state management (tracking mismatches)
- ❌ Large message if many mismatches (Slack has size limits)
- ❌ Harder to correlate with real-time logs
- ❌ Requires refactoring to collect results

---

### Solution 3: Hybrid Approach with Configurable Batching

**Description**: Support both immediate and batched alerts via configuration flag.

**Implementation Approach**:
```javascript
const SLACK_BATCH_ALERTS = process.env.SLACK_BATCH_ALERTS === 'true';

if (SLACK_BATCH_ALERTS) {
  // Collect mismatches, send at end
  mismatches.push({ processId, stateNonce, suRouterNonce });
} else {
  // Send immediately
  await sendSlackAlert(processId, stateNonce, suRouterNonce);
}

// At end of execution
if (SLACK_BATCH_ALERTS && mismatches.length > 0) {
  await sendBatchedSlackAlert(mismatches);
}
```

**Pros**:
- ✅ Flexibility: choose based on deployment
- ✅ Single-process mode: immediate alerts
- ✅ Multi-process mode: batched alerts
- ✅ User can configure behavior
- ✅ Best of both worlds

**Cons**:
- ❌ More complex implementation (two code paths)
- ❌ More configuration to manage
- ❌ More testing required (both modes)
- ❌ Users might be confused about which mode to use
- ❌ Increased code complexity

---

## Solution Comparison Matrix

| Criteria | Solution 1 (Immediate) | Solution 2 (Batched) | Solution 3 (Hybrid) |
|----------|------------------------|----------------------|---------------------|
| **Simplicity** | High | Medium | Low |
| **Real-time Alerts** | Yes | No | Configurable |
| **Multi-Process Friendly** | No (noisy) | Yes | Yes |
| **Dependencies** | Zero | Zero | Zero |
| **Code Complexity** | Low | Medium | High |
| **Configuration** | Simple | Simple | Complex |
| **Notification Delay** | Immediate | End of run | Configurable |
| **Slack API Calls** | N (one per mismatch) | 1 (one summary) | Configurable |
| **Rate Limiting Risk** | High (many processes) | Low | Low (batched mode) |
| **Testing Complexity** | Low | Medium | High |
| **Maintenance** | Easy | Medium | Medium |

---

## Recommended Solution

**Solution 2: Batched Alerts with Summary**

### Rationale

1. **Multi-Process Optimization**: The system now supports multi-process monitoring, making batched alerts more appropriate
2. **Reduced Noise**: One summary message is easier to review than N individual alerts
3. **Rate Limiting**: Avoids hitting Slack API rate limits with many processes
4. **Better UX**: Summary view provides quick overview of all issues
5. **Simpler Configuration**: No need for batching flag (always batch)
6. **Acceptable Delay**: Notification arrives within seconds (end of script run)

### Trade-offs Accepted

- **Delayed Notification**: Alerts arrive after all checks complete (2-60 seconds delay)
  - *Acceptable*: Cron runs frequently (every 5-15 min), so total delay is minimal
  
- **State Management**: Need to track mismatches in array
  - *Acceptable*: Simple array collection, minimal complexity

- **Large Messages**: Many mismatches could create large Slack message
  - *Acceptable*: Unlikely scenario; can add truncation if needed

### Future Enhancement Path

If immediate alerts are needed later:
1. Add `SLACK_BATCH_ALERTS` environment variable
2. Support both modes (upgrade to Solution 3)
3. Document when to use each mode

---

## Implementation Steps

### Phase 1: Slack Webhook Integration

**Step 1.1: Create Slack Message Function**
- Add `sendSlackAlert(mismatches)` function
- Use native `https` module for POST request
- Build Slack message JSON payload
- Handle errors gracefully (log, don't fail)
- Add timeout (5 seconds)

**Step 1.2: Configuration Loading**
- Read `SLACK_WEBHOOK_URL` from environment
- Validate webhook URL format (basic check)
- Optional: `SLACK_ALERT_ON_ERROR` flag (default: false)
- Skip Slack if webhook not configured

**Step 1.3: Error Handling**
- Wrap Slack call in try-catch
- Log Slack errors to stderr
- Don't fail script execution on Slack errors
- Continue with normal exit codes

### Phase 2: Mismatch Collection

**Step 2.1: Refactor Result Tracking**
- Modify `checkProcess()` to return detailed result
- Include: `processId`, `stateNonce`, `suRouterNonce`, `match`, `error`
- Collect results in array during execution

**Step 2.2: Identify Mismatches**
- Filter results for mismatches: `stateNonce !== suRouterNonce`
- Optional: Also collect errors if `SLACK_ALERT_ON_ERROR=true`
- Create array of mismatch objects

**Step 2.3: Summary Generation**
- Count total mismatches
- Build Slack message payload
- Include timestamp, process IDs, nonce values

### Phase 3: Slack Message Formatting

**Step 3.1: Message Structure**
- Main text: "🚨 N Nonce Mismatch(es) Detected"
- Attachments: One per mismatch (or compact format)
- Color: "danger" (red) for visibility
- Fields: Process ID, State Nonce, SU Router Nonce, Timestamp

**Step 3.2: Process ID Formatting**
- Use truncated process ID (existing `truncateProcessId()`)
- Format: `[12345678...abcdefgh]`
- Clickable if possible (future: link to dashboard)

**Step 3.3: Compact Format for Many Mismatches**
- If > 10 mismatches: use compact text format
- Prevent Slack message size limits
- Example: "Process A: 100 vs 101, Process B: 200 vs 202"

### Phase 4: Integration Points

**Step 4.1: Single-Process Mode**
- After `checkProcess()` completes
- If mismatch detected, add to array
- Send Slack alert at end of `main()`

**Step 4.2: Multi-Process Mode**
- After `checkAllProcesses()` completes
- Collect all mismatches from results
- Send single batched Slack alert

**Step 4.3: Exit Code Logic**
- Maintain existing exit codes (0 or 1)
- Slack failure doesn't affect exit code
- Log Slack errors but continue

### Phase 5: Testing & Validation

**Step 5.1: Unit Testing**
- Test Slack payload generation
- Test URL parsing and HTTPS request building
- Test error handling (webhook fails)
- Test timeout behavior

**Step 5.2: Integration Testing**
- Test with real Slack webhook (dev channel)
- Test single mismatch scenario
- Test multiple mismatches scenario
- Test no mismatches (no Slack message)
- Test Slack unavailable scenario

**Step 5.3: Configuration Testing**
- Test with webhook URL set
- Test without webhook URL (no-op)
- Test with invalid webhook URL
- Test with `SLACK_ALERT_ON_ERROR` enabled

### Phase 6: Documentation

**Step 6.1: Update README**
- Document Slack webhook setup
- Explain how to get webhook URL from Slack
- Document environment variables
- Provide example Slack message screenshot

**Step 6.2: Update .env.example**
- Add `SLACK_WEBHOOK_URL` with example format
- Add `SLACK_ALERT_ON_ERROR` with default
- Document each variable

**Step 6.3: Update DEPLOYMENT.md**
- Slack workspace setup instructions
- How to create Incoming Webhook in Slack
- Security considerations (webhook URL is secret)
- Testing Slack integration

**Step 6.4: Update ARCHITECTURE.md**
- Document Slack integration design
- Explain batching approach
- Message format specification
- Error handling strategy

---

## Implementation Specifications

### Slack Message Format

**Single Mismatch:**
```json
{
  "text": "🚨 Nonce Mismatch Detected",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        {
          "title": "Process ID",
          "value": "[0syT13r0...3ElLSrsc]",
          "short": true
        },
        {
          "title": "State Nonce",
          "value": "2205625",
          "short": true
        },
        {
          "title": "SU Router Nonce",
          "value": "2205626",
          "short": true
        },
        {
          "title": "Timestamp",
          "value": "2025-10-03T10:00:00.123Z",
          "short": true
        }
      ]
    }
  ]
}
```

**Multiple Mismatches (Batched):**
```json
{
  "text": "🚨 3 Nonce Mismatches Detected",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        { "title": "Process ID", "value": "[0syT13r0...3ElLSrsc]", "short": true },
        { "title": "State", "value": "2205625", "short": true },
        { "title": "SU Router", "value": "2205626", "short": true }
      ]
    },
    {
      "color": "danger",
      "fields": [
        { "title": "Process ID", "value": "[xU9zFkq3...KQD6dh10]", "short": true },
        { "title": "State", "value": "1500000", "short": true },
        { "title": "SU Router", "value": "1500001", "short": true }
      ]
    }
  ],
  "footer": "AO Network Nonce Monitor",
  "ts": 1696348800
}
```

**Compact Format (> 10 mismatches):**
```json
{
  "text": "🚨 15 Nonce Mismatches Detected",
  "attachments": [
    {
      "color": "danger",
      "text": "• [0syT13r0...3ElLSrsc]: 2205625 vs 2205626\n• [xU9zFkq3...KQD6dh10]: 1500000 vs 1500001\n• ... (13 more)"
    }
  ]
}
```

### Slack Webhook Function

```javascript
const https = require('https');

async function sendSlackAlert(mismatches) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  // Skip if not configured
  if (!webhookUrl) {
    return;
  }
  
  // Skip if no mismatches
  if (!mismatches || mismatches.length === 0) {
    return;
  }
  
  try {
    const message = buildSlackMessage(mismatches);
    await postToSlack(webhookUrl, message);
    console.log(`[${getTimestamp()}] Slack alert sent (${mismatches.length} mismatch${mismatches.length > 1 ? 'es' : ''})`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Failed to send Slack alert: ${error.message}`);
    // Don't throw - continue execution
  }
}

function buildSlackMessage(mismatches) {
  const count = mismatches.length;
  const text = count === 1 
    ? '🚨 Nonce Mismatch Detected'
    : `🚨 ${count} Nonce Mismatches Detected`;
  
  // Compact format for many mismatches
  if (count > 10) {
    const summary = mismatches.slice(0, 10)
      .map(m => `• [${truncateProcessId(m.processId)}]: ${m.stateNonce} vs ${m.suRouterNonce}`)
      .join('\n');
    const more = count > 10 ? `\n... (${count - 10} more)` : '';
    
    return {
      text,
      attachments: [{
        color: 'danger',
        text: summary + more,
        footer: 'AO Network Nonce Monitor',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }
  
  // Detailed format for few mismatches
  return {
    text,
    attachments: mismatches.map(m => ({
      color: 'danger',
      fields: [
        { title: 'Process ID', value: `[${truncateProcessId(m.processId)}]`, short: true },
        { title: 'State Nonce', value: String(m.stateNonce), short: true },
        { title: 'SU Router Nonce', value: String(m.suRouterNonce), short: true },
        { title: 'Timestamp', value: m.timestamp || new Date().toISOString(), short: true }
      ]
    })),
    footer: 'AO Network Nonce Monitor',
    ts: Math.floor(Date.now() / 1000)
  };
}

function postToSlack(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(message);
    const url = new URL(webhookUrl);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(payload);
    req.end();
  });
}
```

### Integration in Main Function

```javascript
async function main() {
  const configFile = process.env.CONFIG_FILE || './process-ids.txt';
  
  try {
    // Multi-process mode
    if (fs.existsSync(configFile)) {
      const processIds = loadConfig(configFile);
      const results = await checkAllProcesses(processIds);
      
      // Generate summary
      const summary = generateSummary(results);
      
      // Collect mismatches
      const mismatches = results.filter(r => 
        !r.error && 
        String(r.stateNonce) !== String(r.suRouterNonce)
      ).map(r => ({
        processId: r.processId,
        stateNonce: r.stateNonce,
        suRouterNonce: r.suRouterNonce,
        timestamp: new Date().toISOString()
      }));
      
      // Send Slack alert if mismatches found
      await sendSlackAlert(mismatches);
      
      // Exit with appropriate code
      process.exit(summary.mismatches > 0 || summary.errors > 0 ? 1 : 0);
    }
    
    // Single-process mode (backward compatible)
    else if (process.env.PROCESS_ID) {
      const processId = process.env.PROCESS_ID;
      const result = await checkProcess(processId);
      
      logResult(null, result.stateNonce, result.suRouterNonce);
      
      // Check for mismatch
      const mismatch = String(result.stateNonce) !== String(result.suRouterNonce);
      
      if (mismatch) {
        await sendSlackAlert([{
          processId,
          stateNonce: result.stateNonce,
          suRouterNonce: result.suRouterNonce,
          timestamp: new Date().toISOString()
        }]);
      }
      
      process.exit(mismatch ? 1 : 0);
    }
    
    // No config
    else {
      logError(null, 'No configuration found');
      console.log('\nHint: Create a process-ids.txt file with one process ID per line, or set PROCESS_ID environment variable for single-process mode.');
      process.exit(1);
    }
  } catch (error) {
    logError(null, error.message);
    process.exit(1);
  }
}
```

---

## Success Criteria

### Functional Success Criteria

- ✅ **Slack Alert Sent**: Message sent to Slack on nonce mismatch
- ✅ **Message Content**: Includes process ID, both nonce values, timestamp
- ✅ **Batched Alerts**: Single message for multiple mismatches in multi-process mode
- ✅ **Configuration**: Controlled via `SLACK_WEBHOOK_URL` environment variable
- ✅ **Graceful Degradation**: Script continues if Slack fails
- ✅ **Error Logging**: Slack errors logged to stderr
- ✅ **No Mismatches**: No Slack message sent when all nonces match
- ✅ **Single-Process Support**: Works in single-process mode
- ✅ **Multi-Process Support**: Works in multi-process mode

### Non-Functional Success Criteria

- ✅ **Performance**: Slack webhook call < 5 seconds
- ✅ **Zero Dependencies**: No new npm packages (native `https` module)
- ✅ **Reliability**: Script succeeds even if Slack API is down
- ✅ **Security**: Webhook URL never hardcoded, only in env var
- ✅ **Backward Compatible**: No breaking changes to existing functionality
- ✅ **Exit Codes**: Maintained (0 = success, 1 = mismatch/error)

### Documentation Success Criteria

- ✅ **README Updated**: Slack setup instructions
- ✅ **.env.example Updated**: `SLACK_WEBHOOK_URL` documented
- ✅ **DEPLOYMENT Updated**: Slack webhook creation guide
- ✅ **Example Message**: Screenshot or JSON example provided
- ✅ **Troubleshooting**: Common Slack issues documented

### Testing Success Criteria

- ✅ **Test with Mismatch**: Slack message sent
- ✅ **Test without Mismatch**: No Slack message sent
- ✅ **Test without Webhook URL**: No error, skips Slack
- ✅ **Test Slack Unavailable**: Logs error, script continues
- ✅ **Test Multiple Mismatches**: Batched message sent
- ✅ **Test Message Format**: Valid Slack JSON payload

---

## Slack Setup Guide

### Creating Slack Incoming Webhook

1. **Navigate to Slack App Configuration**
   - Go to https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"
   - Name: "AO Nonce Monitor"
   - Select your workspace

2. **Enable Incoming Webhooks**
   - In app settings, click "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" to On
   - Click "Add New Webhook to Workspace"
   - Select channel (e.g., #monitoring, #alerts)
   - Click "Allow"

3. **Copy Webhook URL**
   - URL format: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`
   - Store in environment variable: `SLACK_WEBHOOK_URL`
   - **Keep this URL secret** (treat like a password)

4. **Test Webhook**
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     -d '{"text":"Test message from AO Nonce Monitor"}' \
     YOUR_WEBHOOK_URL
   ```

### Environment Configuration

```bash
# .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
SLACK_ALERT_ON_ERROR=false  # Optional: alert on fetch errors
```

---

## Example Output

### Slack Message (Single Mismatch)
```
🚨 Nonce Mismatch Detected

Process ID: [0syT13r0...3ElLSrsc]
State Nonce: 2205625
SU Router Nonce: 2205626
Timestamp: 2025-10-03T10:00:00.123Z

AO Network Nonce Monitor
```

### Slack Message (Multiple Mismatches)
```
🚨 3 Nonce Mismatches Detected

Process ID: [0syT13r0...3ElLSrsc]
State: 2205625 | SU Router: 2205626

Process ID: [xU9zFkq3...KQD6dh10]
State: 1500000 | SU Router: 1500001

Process ID: [abcd1234...34567890]
State: 3000000 | SU Router: 3000002

AO Network Nonce Monitor
```

### Console Output (with Slack)
```bash
$ node nonce-monitor.js

[2025-10-03T10:00:00.123Z] [0syT13r0...3ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205626 | Status: MISMATCH ✗
[2025-10-03T10:00:02.456Z] [xU9zFkq3...KQD6dh10] State Nonce: 1500000 | SU Router Nonce: 1500000 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 2
Matches: 1 ✓
Mismatches: 1 ✗
Errors: 0 ⚠

[2025-10-03T10:00:03.789Z] Slack alert sent (1 mismatch)
```

---

## Risks & Mitigation

### Risk 1: Slack API Unavailable
**Risk**: Slack webhook endpoint is down or unreachable  
**Impact**: Medium - no alerts sent  
**Mitigation**:
- Graceful error handling (log and continue)
- Script still logs to stdout/files
- Cron email notifications as backup
- Monitor Slack integration health

### Risk 2: Webhook URL Exposure
**Risk**: Webhook URL leaked or committed to version control  
**Impact**: High - unauthorized messages to Slack  
**Mitigation**:
- Store only in environment variable
- Add `.env` to `.gitignore`
- Document security best practices
- Rotate webhook if compromised

### Risk 3: Rate Limiting
**Risk**: Too many Slack messages trigger rate limits  
**Impact**: Low - messages dropped  
**Mitigation**:
- Batched alerts reduce API calls
- Cron interval spacing (5-15 min)
- Slack has generous rate limits (1 request/second)

### Risk 4: Large Message Size
**Risk**: Many mismatches exceed Slack message size limit (40 KB)  
**Impact**: Low - message fails to send  
**Mitigation**:
- Compact format for > 10 mismatches
- Truncate if needed (first 50 mismatches)
- Log warning if truncated

### Risk 5: Timeout Delays
**Risk**: Slack webhook timeout delays script execution  
**Impact**: Low - slight delay in cron job  
**Mitigation**:
- 5-second timeout on Slack requests
- Async operation (doesn't block)
- Total delay < 10 seconds acceptable

---

## Future Enhancements

### Phase 2 Features (Post-Launch)
1. **Slack Channels**: Different channels for different severities
2. **Mention Users**: @mention on-call engineer for critical alerts
3. **Alert Throttling**: Alert only after N consecutive failures
4. **Rich Formatting**: Use Slack blocks for better UI
5. **Dashboard Links**: Link to monitoring dashboard in message

### Phase 3 Features (Long-term)
1. **Interactive Messages**: Slack buttons (acknowledge, mute, etc.)
2. **Slack Commands**: Query nonce status from Slack
3. **Multiple Webhooks**: Support different channels per process
4. **Alert Rules**: Configurable alert conditions (threshold, time-based)
5. **Metrics Integration**: Track alert frequency, response time

---

## Approval & Sign-Off

**Project Scope**: Approved ✅  
**Technical Approach**: Batched alerts with native HTTPS (Solution 2) ✅  
**Implementation Plan**: 6 phases ✅  
**Success Criteria**: Defined and measurable ✅  
**Risk Mitigation**: Documented ✅  

**Ready for Implementation**: ✅

---

**Document Version**: 1.0  
**Created**: October 3, 2025  
**Status**: Approved for Implementation  
**Estimated Effort**: 1-2 days (1 developer)  
**Dependencies**: Extends multi-process nonce-monitor.js
