# Project Request Protocol: Nonce Monitor

## Project Overview

### Purpose
Create a JavaScript cron script that monitors and validates the synchronization of nonce values between two AO network endpoints for a specific process ID.

### Background
The AO network maintains state consistency across different services. This monitoring script will:
- Poll two endpoints for the same process (`0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc`)
- Extract and compare nonce values from different response formats
- Log comparison results to detect synchronization issues

### Endpoints
1. **State Endpoint**: `https://state.forward.computer/{processId}/compute/at-slot`
   - Returns: Plain text nonce value (e.g., `2205625`)
   
2. **SU Router Endpoint**: `https://su-router.ao-testnet.xyz/{processId}/latest`
   - Returns: JSON object with nested structure
   - Nonce location: `assignment.tags[]` where `name === "Nonce"`

### Success Indicators
- Automated periodic checks (cron-based)
- Accurate nonce extraction from both sources
- Clear logging of match/mismatch status
- Resilient error handling for network failures

---

## Technical Requirements

### Functional Requirements
1. **HTTP Requests**: Fetch data from both endpoints
2. **Data Parsing**:
   - Parse plain text response from state endpoint
   - Parse JSON and extract nonce from assignment tags array
3. **Comparison Logic**: Compare nonce values (type-safe comparison)
4. **Logging**: Output timestamped results indicating match status
5. **Scheduling**: Run on a configurable interval (cron)
6. **Error Handling**: Handle network errors, parsing errors, missing fields

### Non-Functional Requirements
- Minimal dependencies
- Easy configuration (process ID, interval)
- Clear, structured logs
- Runs in Node.js environment

### Constraints
- Must work with existing Node.js runtime
- Should be lightweight (suitable for long-running processes)
- Must handle API changes gracefully (defensive parsing)

---

## Proposed Solutions

### Solution 1: Node.js with `node-cron` + `axios`

**Description**: Use popular npm packages for scheduling and HTTP requests.

**Stack**:
- `node-cron`: Cron-like scheduling in Node.js
- `axios`: Promise-based HTTP client
- Standard Node.js logging

**Implementation Approach**:
```javascript
const cron = require('node-cron');
const axios = require('axios');

cron.schedule('*/5 * * * *', async () => {
  // Fetch both endpoints
  // Parse responses
  // Compare and log
});
```

**Pros**:
- Simple, well-documented libraries
- Familiar to most JavaScript developers
- Axios provides clean error handling and JSON parsing
- `node-cron` has human-readable syntax
- Easy to test and debug

**Cons**:
- Adds 2 external dependencies
- `node-cron` runs in-process (requires long-running Node process)
- Not suitable for system-level scheduling (restarts require process restart)

---

### Solution 2: Native Node.js with `setInterval` + `fetch`

**Description**: Use built-in Node.js features (v18+) with native fetch API.

**Stack**:
- `setInterval`: Built-in JavaScript timer
- `fetch`: Native HTTP client (Node.js v18+)
- No external dependencies

**Implementation Approach**:
```javascript
async function checkNonce() {
  // Fetch using native fetch()
  // Parse and compare
  // Log results
}

setInterval(checkNonce, 5 * 60 * 1000);
checkNonce(); // Run immediately
```

**Pros**:
- Zero dependencies (Node.js 18+)
- Lighter weight
- Uses modern web-standard APIs
- Simpler deployment (no npm install needed)
- Native fetch has built-in JSON parsing

**Cons**:
- Requires Node.js v18 or higher
- `setInterval` less flexible than cron syntax (fixed intervals only)
- No built-in drift protection (interval delays accumulate)
- Still requires long-running process

---

### Solution 3: Standalone Script + System Cron

**Description**: Create a one-shot script executed by system cron (crontab).

**Stack**:
- Native `fetch` for HTTP requests
- System cron for scheduling
- Standalone execution model

**Implementation Approach**:
```javascript
#!/usr/bin/env node

async function main() {
  // Fetch both endpoints
  // Parse and compare
  // Log to stdout/file
}

main().catch(console.error);
```

**Crontab entry**:
```
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
```

**Pros**:
- No long-running process needed
- System-level reliability (cron restarts, survives crashes)
- Zero npm dependencies
- Integrates with system logging and monitoring
- Better for production environments
- Clear execution boundaries (easier debugging)

**Cons**:
- Requires system cron access
- Platform-dependent (Unix/Linux cron)
- More setup steps (crontab configuration)
- Logging requires separate configuration

---

## Solution Comparison Matrix

| Criteria | Solution 1 (node-cron) | Solution 2 (setInterval) | Solution 3 (System Cron) |
|----------|------------------------|--------------------------|--------------------------|
| Dependencies | 2 packages | 0 (Node 18+) | 0 (Node 18+) |
| Reliability | Process-dependent | Process-dependent | System-level |
| Setup Complexity | Low | Lowest | Medium |
| Production Readiness | Medium | Low | High |
| Flexibility | High (cron syntax) | Low (fixed intervals) | High (cron syntax) |
| Resource Usage | Medium | Low | Lowest |
| Debugging | Easy | Easy | Medium |

---

## Recommended Solution

**Solution 3: Standalone Script + System Cron**

### Rationale
1. **Production-Grade**: System cron is battle-tested for scheduling tasks
2. **Reliability**: No long-running process to crash or manage
3. **Simplicity**: Zero dependencies, minimal attack surface
4. **Observability**: Each execution is isolated, easier to debug and log
5. **Resource Efficiency**: Only runs when needed, no idle process
6. **Standard Practice**: Industry standard for monitoring scripts

### Trade-offs Accepted
- Requires initial crontab setup
- Platform-dependent (but acceptable for most deployments)
- Slightly more complex initial configuration

---

## Implementation Steps

### Phase 1: Core Script Development
1. **Create script file**: `nonce-monitor.js`
2. **Implement HTTP fetching**:
   - Fetch state endpoint (plain text)
   - Fetch SU router endpoint (JSON)
3. **Implement parsing**:
   - Parse plain text as integer
   - Extract nonce from `assignment.tags` array
4. **Implement comparison logic**:
   - Type-safe comparison
   - Handle missing/invalid values
5. **Implement logging**:
   - ISO timestamp
   - Both nonce values
   - Match status

### Phase 2: Error Handling
1. **Network error handling**: Try-catch with timeout
2. **Parsing error handling**: Validate response structure
3. **Missing field handling**: Check for undefined/null
4. **Graceful degradation**: Log errors, exit with status code

### Phase 3: Configuration
1. **Make process ID configurable**: Environment variable or CLI arg
2. **Add configurable timeout**: HTTP request timeout
3. **Document configuration**: README with usage

### Phase 4: Deployment
1. **Make script executable**: `chmod +x nonce-monitor.js`
2. **Test manual execution**: Run script directly
3. **Configure crontab**:
   ```
   */5 * * * * /usr/bin/node /path/to/nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   ```
4. **Set up log rotation**: Prevent log file growth

### Phase 5: Testing & Validation
1. **Test with current process ID**: Verify correct parsing
2. **Test error scenarios**: Network failure, malformed response
3. **Test logging output**: Verify timestamp and format
4. **Monitor initial runs**: Check cron execution logs

---

## Success Criteria

### Functional Success
- ✅ Script successfully fetches from both endpoints
- ✅ Correctly parses plain text nonce
- ✅ Correctly extracts nonce from JSON `assignment.tags[name=Nonce].value`
- ✅ Accurately compares values (type-safe)
- ✅ Logs results with timestamp

### Operational Success
- ✅ Runs automatically every N minutes (configurable)
- ✅ Handles network failures gracefully
- ✅ Handles API response changes gracefully
- ✅ Logs are readable and actionable
- ✅ No crashes or silent failures

### Quality Metrics
- **Uptime**: >99% successful executions over 24 hours
- **Error Rate**: <1% under normal network conditions
- **Log Clarity**: Anyone can understand match/mismatch from logs
- **Response Time**: Completes within 10 seconds per check

### Documentation Success
- ✅ README explains how to run script
- ✅ Configuration options documented
- ✅ Cron setup instructions included
- ✅ Example log output provided

---

## Example Expected Log Output

```
[2025-01-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-01-03T10:05:00.456Z] State Nonce: 2205626 | SU Router Nonce: 2205626 | Status: MATCH ✓
[2025-01-03T10:10:00.789Z] State Nonce: 2205628 | SU Router Nonce: 2205627 | Status: MISMATCH ✗
[2025-01-03T10:15:00.012Z] ERROR: Failed to fetch state endpoint - Network timeout
```

---

## Future Enhancements (Optional)

1. **Alerting**: Send notifications on mismatch (email, Slack, PagerDuty)
2. **Metrics Export**: Export to Prometheus/Grafana
3. **Historical Tracking**: Store nonce history in database
4. **Multi-Process Monitoring**: Monitor multiple process IDs
5. **Drift Analysis**: Track and analyze nonce synchronization lag
6. **Health Endpoint**: Expose HTTP health check endpoint
