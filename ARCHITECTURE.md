# Architecture Documentation

## 1. Solution Overview

### Why Standalone Script vs Long-Running Process

The monitoring system is implemented as a **standalone script** rather than a long-running process for several critical reasons:

- **Resource Efficiency**: No idle memory consumption between checks. The script runs, performs its check, logs results, and exits completely, freeing all resources.
- **Fault Isolation**: Each execution is independent. If one check fails or crashes, it doesn't affect subsequent checks. No need for crash recovery or restart logic.
- **Simplicity**: No state management, no event loops to manage, no connection pooling. Each run is a clean slate.
- **Observability**: Process lifecycle is explicit. Start time, end time, and exit codes are naturally tracked by the system scheduler.
- **Deployment**: Updates and changes don't require process restart management—next scheduled run picks up changes automatically.

### Why System Cron vs node-cron

**System cron** is chosen over JavaScript-based scheduling libraries like `node-cron` because:

- **Reliability**: System cron has decades of battle-tested stability. It runs independently of the Node.js process lifecycle.
- **Process Isolation**: Each script execution is a separate process. Memory leaks or bugs can't accumulate across runs.
- **System Integration**: Native OS-level scheduling with proper logging to system logs, email notifications on failures, and integration with system monitoring tools.
- **Resource Management**: No overhead of maintaining a scheduler process. The scheduler itself is handled by the OS daemon which is already running.
- **Operational Familiarity**: Standard Unix tool that ops teams know how to configure, debug, and monitor.

### Why Zero Dependencies Approach

The script is intentionally built with **zero external dependencies**:

- **Security**: No third-party code means no supply chain vulnerabilities. No need to audit dependencies or monitor for CVEs.
- **Maintenance**: No dependency updates, no breaking changes from upstream packages, no compatibility issues.
- **Installation**: Instant deployment. Copy script, run it. No `npm install`, no `node_modules` directory.
- **Bundle Size**: Single file under 10KB. Fast to transfer, fast to parse, fast to execute.
- **Reliability**: Native Node.js APIs are stable and well-tested. Features like `fetch` are now built into Node.js 18+.
- **Auditability**: Single file means complete code review in minutes. No hidden behavior in dependencies.

## 2. Technical Stack

### Node.js 18+ Native Fetch

The script leverages **Node.js 18+** for its native `fetch` implementation:

```javascript
const response = await fetch(url, { 
  signal: AbortSignal.timeout(timeout) 
});
```

**Key capabilities:**
- HTTP/HTTPS requests without external libraries
- Built-in timeout support via `AbortSignal`
- Promise-based async/await pattern
- Automatic redirect following
- JSON parsing with `.json()` method
- Text parsing with `.text()` method

### No External Dependencies Rationale

**Standard Library Coverage:**

| Requirement | Native Node.js Solution |
|-------------|------------------------|
| HTTP requests | `fetch` API (Node 18+) |
| JSON parsing | `JSON.parse()` / `response.json()` |
| Environment vars | `process.env` |
| Command line args | `process.argv` |
| Logging | `console.log()` / `console.error()` |
| Timestamps | `new Date().toISOString()` |
| Exit codes | `process.exit()` |

**Benefits:**
- Install time: 0 seconds (no package installation)
- Security surface: Minimal (only Node.js runtime)
- Compatibility: Guaranteed (native APIs have stability guarantees)
- Performance: Maximum (no abstraction layers)

### Platform Requirements

- **Runtime**: Node.js >= 18.0.0 (for native `fetch` support)
- **Operating System**: Any Unix-like system with cron (Linux, macOS, BSD) or Windows with Task Scheduler
- **Permissions**: Standard user permissions (no root required)
- **Network**: Outbound HTTPS access to:
  - `state.forward.computer`
  - `su-router.ao-testnet.xyz`

## 3. Script Architecture

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         START                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Load Configuration                                  │
│  • Check for CONFIG_FILE (or ./process-ids.txt)                 │
│  • If exists: multi-process mode                                │
│  • If not exists: check PROCESS_ID env var (single mode)        │
│  • Set REQUEST_TIMEOUT (default: 10000ms)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    ┌────┴────┐
                    │ Config  │
                    │ exists? │
                    └────┬────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼ YES                             ▼ NO
┌───────────────────┐          ┌──────────────────────┐
│ Multi-Process     │          │ Single-Process Mode  │
│ Mode              │          │                      │
└────────┬──────────┘          └──────────┬───────────┘
         │                                │
         ▼                                ▼
┌─────────────────────────────┐  ┌──────────────────────┐
│ Parse Config File           │  │ Use PROCESS_ID       │
│ • Read plain text file      │  │ • Check environment  │
│ • Skip empty/comment lines  │  │ • Validate presence  │
│ • Validate each process ID  │  └──────────┬───────────┘
│ • Collect valid IDs         │             │
└────────┬────────────────────┘             │
         │                                  │
         ▼                                  ▼
┌─────────────────────────────┐  ┌──────────────────────┐
│ Sequential Process Loop     │  │ Fetch Endpoints      │
│ • For each process ID       │  │ • State + SU Router  │
│ • Check one at a time       │  │ • Parallel fetch     │
│ • Log individual results    │  └──────────┬───────────┘
│ • Continue on error         │             │
└────────┬────────────────────┘             │
         │                                  │
         ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│           Fetch State + SU Router Endpoints (Parallel)          │
│  State: https://state.forward.computer/{processId}/compute/...  │
│  SU Router: https://su-router.ao-testnet.xyz/{processId}/...   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Parse Responses                                     │
│  • State: Extract nonce from plain text                         │
│  • SU Router: Navigate JSON structure to extract nonce          │
│    - Parse assignment.tags array                                │
│    - Find tag with name === "Nonce"                             │
│    - Extract value property                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Compare Nonces                                      │
│  if (stateNonce === suRouterNonce)                              │
│    status = "MATCH"                                             │
│  else                                                            │
│    status = "MISMATCH"                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Log Results                                         │
│  Single: [ISO-8601] State Nonce: X | SU Router Nonce: Y |       │
│          Status: MATCH/MISMATCH                                 │
│  Multi: [ISO-8601] [PID...] State Nonce: X | SU Router Nonce: Y │
│         | Status: MATCH ✓ / MISMATCH ✗                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    ┌────┴────┐
                    │ Multi-  │
                    │ Process?│
                    └────┬────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼ YES                             ▼ NO
┌───────────────────┐          ┌──────────────────────┐
│ Generate Summary  │          │ Send Slack Alert     │
│ • Total processes │          │ (if MISMATCH +       │
│ • Matches count   │          │  SLACK_WEBHOOK_URL)  │
│ • Mismatches count│          │ • Try-catch wrapped  │
│ • Errors count    │          │ • Log on error       │
│ • Exit 1 if any   │          │ • Continue on fail   │
│   errors/mismatch │          └──────────┬───────────┘
└────────┬──────────┘                     │
         │                                │
         ▼                                ▼
┌───────────────────┐          ┌──────────────────────┐
│ Send Slack Alert  │          │ EXIT                 │
│ (if mismatches +  │          │ • Code 0: Success    │
│  SLACK_WEBHOOK_   │          │ • Code 1: Error      │
│  URL)             │          └──────────────────────┘
│ • Batched summary │
│ • Try-catch wrap  │
│ • Log on error    │
│ • Continue on fail│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ EXIT              │
│ • Code 0: All OK  │
│ • Code 1: Issues  │
└───────────────────┘
```

### Data Flow Between Components

```
Config File (optional)     Environment Variables      Command Line Args
 (process-ids.txt)          (PROCESS_ID/CONFIG_FILE)    (future use)
         │                            │                       │
         └────────────────┬───────────┴───────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Configuration │
                  │   Resolver    │
                  └───────┬───────┘
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
       ┌──────────────┐         ┌─────────────┐
       │ Single Mode  │         │ Multi Mode  │
       │ (PROCESS_ID) │         │ (Config)    │
       └──────┬───────┘         └──────┬──────┘
              │                        │
              │                        ▼
              │              ┌──────────────────┐
              │              │ Sequential Loop  │
              │              │ (one at a time)  │
              │              └──────┬───────────┘
              │                     │
              └──────────┬──────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────┐                ┌──────────────┐
│ State API    │                │ SU Router    │
│ Fetcher      │                │ API Fetcher  │
└──────┬───────┘                └──────┬───────┘
       │                               │
       │  Plain Text                   │  JSON Response
       │  Nonce                         │  {assignment: {...}}
       │                               │
       ▼                               ▼
┌──────────────┐                ┌──────────────┐
│ Text Parser  │                │ JSON Parser  │
│              │                │ Tag Extractor│
└──────┬───────┘                └──────┬───────┘
       │                               │
       │  stateNonce                   │  suRouterNonce
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
               ┌──────────────┐
               │  Comparator  │
               └──────┬───────┘
                      │
                      │  Comparison Result
                      │
                      ▼
               ┌──────────────┐
               │   Logger     │
               │ (per-process │
               │  or summary) │
               └──────┬───────┘
                      │
                      ▼
                stdout/stderr
```

## 4. Slack Integration

### Overview of Slack Alerting System

The monitoring system includes **native Slack integration** for real-time alerting on nonce mismatches:

- **Batched alerts**: Collects all mismatches during execution and sends a single summary message at the end
- **Multi-process optimization**: Reduces noise by consolidating multiple failures into one notification
- **Native HTTPS approach**: Uses Node.js native `fetch` API—zero external dependencies
- **Graceful degradation**: Slack failures never stop script execution; errors are logged and execution continues

**Design Philosophy:**
> Slack integration is an optional, non-critical enhancement. Core monitoring functionality never depends on external notification services.

### Slack Webhook Communication

**Protocol: Slack Incoming Webhooks**

The script communicates with Slack via [Incoming Webhooks](https://api.slack.com/messaging/webhooks):

```javascript
await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(slackPayload),
  signal: AbortSignal.timeout(5000)  // 5-second timeout
});
```

**Request Specification:**
- **Method**: POST
- **Content-Type**: `application/json`
- **Authentication**: None (webhook URL acts as secret)
- **Timeout**: 5 seconds (prevents hanging on Slack API issues)

**Message Format:**
```json
{
  "attachments": [
    {
      "color": "danger",
      "title": "🚨 Nonce Mismatch Detected",
      "fields": [
        { "title": "Process ID", "value": "ivJt7oYs...5fHo", "short": false },
        { "title": "State Nonce", "value": "5243124", "short": true },
        { "title": "SU Router Nonce", "value": "5243123", "short": true }
      ],
      "footer": "AO Nonce Monitor",
      "ts": 1704294600
    }
  ]
}
```

**Response Handling:**
- **2xx status**: Alert sent successfully
- **4xx/5xx status**: Logged to stderr, execution continues
- **Timeout**: Logged to stderr, execution continues
- **Network error**: Logged to stderr, execution continues

### Alert Batching Strategy

**Mismatch Collection During Execution:**

```javascript
async function checkAllProcesses(processIds) {
  const results = [];
  const mismatches = [];  // Collect mismatches
  
  for (const processId of processIds) {
    const result = await checkProcess(processId);
    results.push(result);
    
    // Collect mismatches for later alerting
    if (!result.error && !result.match) {
      mismatches.push(result);
    }
    
    // Log immediately (real-time feedback)
    logResult(result);
  }
  
  // Send single summary alert at the end
  if (mismatches.length > 0) {
    await sendSlackAlert(mismatches);
  }
  
  return results;
}
```

**Batching Benefits:**

| Approach | Messages/Run (10 mismatches) | Noise Level | User Experience |
|----------|------------------------------|-------------|-----------------|
| **Per-process alerts** | 10 separate notifications | High 🔔🔔🔔 | Notification fatigue |
| **Batched summary** | 1 consolidated notification | Low 🔔 | Clear, actionable |

**Rationale:**
1. **Less noise**: One alert instead of N alerts for N mismatches
2. **Better UX**: Single message with all context vs. fragmented notifications
3. **Rate-limit friendly**: Respects Slack API rate limits (1 message vs N messages)
4. **Actionable**: Summary format enables quick assessment of scope
5. **Efficient**: Reduces Slack API calls and network traffic

### Message Format Design

**Format Selection Logic:**

The script uses two different formats based on the number of mismatches:

```javascript
function formatSlackMessage(mismatches) {
  if (mismatches.length <= 10) {
    return formatDetailedMessage(mismatches);  // Attachments with fields
  } else {
    return formatCompactMessage(mismatches);   // Text list with truncation
  }
}
```

**Detailed Format (≤ 10 mismatches):**

Uses Slack attachments with structured fields for rich formatting:

```json
{
  "attachments": [
    {
      "color": "danger",
      "title": "🚨 Nonce Mismatch Detected",
      "fields": [
        { "title": "Process ID", "value": "ivJt7oYs...5fHo", "short": false },
        { "title": "State Nonce", "value": "5243124", "short": true },
        { "title": "SU Router Nonce", "value": "5243123", "short": true }
      ],
      "footer": "AO Nonce Monitor",
      "ts": 1704294600
    },
    {
      "color": "danger",
      "title": "🚨 Nonce Mismatch Detected",
      "fields": [
        { "title": "Process ID", "value": "abc123de...stu901", "short": false },
        { "title": "State Nonce", "value": "9876543", "short": true },
        { "title": "SU Router Nonce", "value": "9876542", "short": true }
      ],
      "footer": "AO Nonce Monitor",
      "ts": 1704294600
    }
  ]
}
```

**Compact Format (> 10 mismatches):**

Uses plain text list to avoid Slack message size limits:

```json
{
  "text": "🚨 *15 Nonce Mismatches Detected*\n\n```\nProcess ID: ivJt7oYs...5fHo | State: 5243124 | SU Router: 5243123\nProcess ID: abc123de...stu901 | State: 9876543 | SU Router: 9876542\nProcess ID: xyz987wv...gf210 | State: 1111111 | SU Router: 1111110\n... (showing first 10 of 15 mismatches)\n```\n\n_See logs for complete details_"
}
```

**Process ID Truncation:**
- Reuses existing `truncateProcessId()` function
- Format: `first8...last8` (e.g., `ivJt7oYs...5Fm5fHo`)
- Keeps messages readable and compact

**Color Coding:**
- **`danger` (red)**: Nonce mismatches (critical issue)
- Future: `warning` (yellow) for errors, `good` (green) for recovery

**Timestamp in Footer:**
- Uses Unix timestamp (`ts` field) for automatic timezone conversion
- Slack displays in user's local timezone

### Error Handling Strategy

**Design Principle:**
> Slack integration failures must never impact core monitoring functionality

**Implementation:**

```javascript
async function sendSlackAlert(mismatches) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  // Skip if webhook not configured (not an error)
  if (!webhookUrl) {
    return;
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatSlackMessage(mismatches)),
      signal: AbortSignal.timeout(5000)  // 5-second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }
  } catch (error) {
    // Log error to stderr, continue execution
    console.error(`[${new Date().toISOString()}] SLACK ERROR: ${error.message}`);
    // Execution continues—monitoring is unaffected
  }
}
```

**Error Scenarios and Handling:**

| Error Type | Cause | Handling | Impact on Script |
|------------|-------|----------|------------------|
| **Network timeout** | Slack API slow/down | Log to stderr, continue | None—monitoring succeeds |
| **HTTP 4xx** | Invalid webhook URL | Log to stderr, continue | None—monitoring succeeds |
| **HTTP 5xx** | Slack server error | Log to stderr, continue | None—monitoring succeeds |
| **DNS failure** | Network misconfiguration | Log to stderr, continue | None—monitoring succeeds |
| **AbortError** | 5-second timeout exceeded | Log to stderr, continue | None—monitoring succeeds |

**Timeout Configuration:**
```javascript
signal: AbortSignal.timeout(5000)  // 5 seconds
```

- **Rationale**: Prevents script from hanging on Slack API issues
- **Typical Slack latency**: 100-500ms
- **Safety margin**: 10x typical latency
- **Trade-off**: Fast failure vs. resilience to temporary slowness

**No Retry Logic:**
- **Fail fast**: Single attempt, log error, move on
- **Rationale**: Next cron run (in 5 minutes) will alert if issue persists
- **Simplicity**: No retry state management or exponential backoff
- **Monitoring integrity**: Script exits quickly with correct exit code

**Logging Strategy:**
```
[2025-10-03T14:30:01.234Z] SLACK ERROR: Request timeout after 5000ms
[2025-10-03T14:30:01.234Z] SLACK ERROR: Slack API returned 404
[2025-10-03T14:30:01.234Z] SLACK ERROR: Invalid webhook URL
```

- Prefixed with `SLACK ERROR:` for easy filtering
- ISO 8601 timestamp for correlation with monitoring logs
- Descriptive error messages for debugging

## 5. Multi-Process Architecture

### Configuration File Format

**Plain Text Design:**
- One process ID per line
- Comments supported (lines starting with `#`)
- Empty lines ignored
- No JSON/YAML overhead
- Human-readable and editable

**Example `process-ids.txt`:**
```
# Production AO Processes
ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo

# Staging environment
abc123def456ghi789jkl012mno345pqr678stu901

# Testing process
xyz987wvu654tsr321qpo098nml765kji432hgf210
```

### Configuration Loading and Parsing

**Loading Logic (nonce-monitor.js:22-53):**

```javascript
function loadConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const processIds = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    
    // Validate and collect process IDs
    if (isValidProcessId(line)) {
      processIds.push(line);
    } else {
      console.warn(`WARNING: Invalid process ID on line ${i + 1}`);
    }
  }
  
  if (processIds.length === 0) {
    throw new Error('No valid process IDs found in config file');
  }
  
  return processIds;
}
```

**Process ID Validation (nonce-monitor.js:18-20):**
```javascript
function isValidProcessId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}
```

**Key Design Decisions:**
- **Line-by-line parsing**: Simple and efficient
- **Graceful degradation**: Warns on invalid lines, continues processing
- **Validation**: Ensures non-empty strings
- **Error handling**: Throws if no valid IDs found

### Sequential Execution Rationale

**Why Sequential vs Parallel:**

```javascript
async function checkAllProcesses(processIds) {
  const results = [];
  
  // Sequential: one at a time
  for (const processId of processIds) {
    const result = await checkProcess(processId);
    results.push(result);
    
    if (result.error) {
      logError(result.processId, result.error);
    } else {
      logResult(result.processId, result.stateNonce, result.suRouterNonce);
    }
  }
  
  return results;
}
```

**Advantages of Sequential Execution:**
1. **Resource control**: Limits concurrent network connections
2. **Predictable load**: Doesn't overwhelm target APIs
3. **Clear logging**: Results appear in order
4. **Error isolation**: One failure doesn't affect others
5. **Simplicity**: Easier to reason about execution flow

**Performance Tradeoff:**
- 10 processes × ~200ms each = ~2 seconds total
- Acceptable for monitoring use case (runs every 5 minutes)
- Parallel execution would be ~200ms but risks API rate limits

### Result Aggregation

**Individual Results Tracked:**
```javascript
async function checkProcess(processId) {
  try {
    const [stateNonce, suRouterNonce] = await Promise.all([...]);
    const match = String(stateNonce) === String(suRouterNonce);
    
    return {
      processId,
      stateNonce,
      suRouterNonce,
      match,
      error: null
    };
  } catch (error) {
    return {
      processId,
      stateNonce: null,
      suRouterNonce: null,
      match: false,
      error: error.message
    };
  }
}
```

**Aggregation Strategy:**
- Each process check returns a result object
- Results collected in array
- Logged immediately (real-time feedback)
- Used for final summary generation

### Summary Reporting

**Summary Generation (nonce-monitor.js:198-211):**

```javascript
function generateSummary(results) {
  const total = results.length;
  const matches = results.filter(r => r.match && !r.error).length;
  const mismatches = results.filter(r => !r.match && !r.error).length;
  const errors = results.filter(r => r.error).length;
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total Processes: ${total}`);
  console.log(`Matches: ${matches} ✓`);
  console.log(`Mismatches: ${mismatches} ✗`);
  console.log(`Errors: ${errors} ⚠`);
  
  return (errors > 0 || mismatches > 0) ? 1 : 0;
}
```

**Exit Code Logic:**
- **Exit 0**: All processes matched successfully
- **Exit 1**: Any mismatches or errors occurred
- Enables cron-based alerting on failures

**Example Summary Output:**
```
=== SUMMARY ===
Total Processes: 10
Matches: 8 ✓
Mismatches: 1 ✗
Errors: 1 ⚠
```

## 5. Execution Modes

### Single-Process Mode

**Trigger Condition:**
- No config file found at `CONFIG_FILE` path (default: `./process-ids.txt`)
- Falls back to `PROCESS_ID` environment variable

**Behavior:**
```javascript
const processId = process.env.PROCESS_ID;

if (!processId) {
  logError(null, 'No config file and PROCESS_ID not set');
  process.exit(1);
}

const [stateNonce, suRouterNonce] = await Promise.all([...]);
logResult(null, stateNonce, suRouterNonce);
process.exit(0);
```

**Characteristics:**
- Single API call pair (state + SU router)
- No summary generation
- Simple log format (no process ID prefix)
- Exit code: 0 for success, 1 for error
- **Backward compatible** with original implementation

**Usage:**
```bash
PROCESS_ID=ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo node nonce-monitor.js
```

### Multi-Process Mode

**Trigger Condition:**
- Config file exists at `CONFIG_FILE` path

**Behavior:**
```javascript
if (fs.existsSync(configFile)) {
  const processIds = loadConfig(configFile);
  const results = await checkAllProcesses(processIds);
  const exitCode = generateSummary(results);
  process.exit(exitCode);
}
```

**Characteristics:**
- Sequential process checking
- Individual result logging with process ID prefix
- Summary report generation
- Exit code: 0 if all match, 1 if any mismatch/error
- Supports unlimited process IDs

**Usage:**
```bash
CONFIG_FILE=./process-ids.txt node nonce-monitor.js
# or (uses default ./process-ids.txt)
node nonce-monitor.js
```

### Mode Detection Logic

**Detection Flow (nonce-monitor.js:216-227):**

```javascript
async function main() {
  const configFile = process.env.CONFIG_FILE || './process-ids.txt';
  
  if (fs.existsSync(configFile)) {
    // Multi-process mode
    const processIds = loadConfig(configFile);
    const results = await checkAllProcesses(processIds);
    const exitCode = generateSummary(results);
    process.exit(exitCode);
  } else {
    // Single-process mode (fallback)
    const processId = process.env.PROCESS_ID;
    if (!processId) {
      logError(null, 'No config file and PROCESS_ID not set');
      process.exit(1);
    }
    // ... single process check
  }
}
```

**Decision Tree:**
```
Start
  │
  ├─> CONFIG_FILE exists?
  │     │
  │     ├─> YES: Multi-process mode
  │     │         └─> Load config, check all processes, summary
  │     │
  │     └─> NO: Single-process mode
  │               │
  │               ├─> PROCESS_ID set?
  │               │     │
  │               │     ├─> YES: Check single process
  │               │     └─> NO: Error and exit
```

### Fallback Behavior

**Priority Order:**
1. **Config file** (highest priority)
   - If exists: multi-process mode activated
   - Ignores `PROCESS_ID` environment variable
   
2. **PROCESS_ID environment variable** (fallback)
   - Used only when no config file found
   - Single-process mode
   
3. **Error exit** (no valid configuration)
   - Neither config file nor PROCESS_ID available
   - Logs descriptive error message
   - Exit code 1

**Error Message:**
```
[2025-10-03T14:30:00.123Z] ERROR: No config file found at ./process-ids.txt and PROCESS_ID environment variable not set. Please provide either a config file or set PROCESS_ID.
```

## 6. Configuration Design

### Plain Text Format Rationale

**Why Plain Text Over JSON/YAML:**

| Aspect | Plain Text | JSON | YAML |
|--------|-----------|------|------|
| **Editing** | Any text editor | Syntax sensitive | Indentation sensitive |
| **Parsing** | 10 lines of code | Native support | Requires library |
| **Errors** | Graceful (skip invalid) | Fatal on syntax error | Fatal on syntax error |
| **Size** | Minimal | Overhead (~30%) | Overhead (~20%) |
| **Human** | Most readable | Less readable | Moderate readable |

**Plain Text Advantages:**
- **Zero dependencies**: No JSON schema or YAML parser needed
- **Fault tolerant**: Invalid lines skipped with warnings
- **Git-friendly**: Line-based diffs, easy merging
- **Shell-friendly**: Can be generated with `echo >> file`
- **Documentation inline**: Comment support for annotations

### Comment Support

**Implementation:**
```javascript
if (line === '' || line.startsWith('#')) {
  continue;
}
```

**Use Cases:**
- Annotate process groups (production, staging, test)
- Document process ownership or purpose
- Temporarily disable processes (comment out)
- Add deployment dates or change notes

**Example:**
```
# Production processes - deployed 2025-01-15
ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo

# Disabled for maintenance
# abc123def456ghi789jkl012mno345pqr678stu901

# Canary deployment - monitor closely
xyz987wvu654tsr321qpo098nml765kji432hgf210
```

### Parsing Strategy

**Line-by-Line Processing:**
1. Read entire file as UTF-8 text
2. Split on newline characters (`\n`)
3. Iterate with line number tracking
4. Trim whitespace from each line
5. Skip empty lines and comments
6. Validate remaining lines as process IDs
7. Collect valid IDs or warn on invalid

**Code Flow:**
```javascript
const lines = content.split('\n');  // Array of lines
const processIds = [];               // Accumulator

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();      // Normalize
  
  if (skip_condition) continue;      // Filter
  if (validate(line)) {              // Validate
    processIds.push(line);           // Collect
  } else {
    warn(i + 1, line);               // Report
  }
}
```

### Validation Approach

**Current Validation (nonce-monitor.js:18-20):**
```javascript
function isValidProcessId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}
```

**Validation Criteria:**
- Must be string type
- Must not be empty after trimming
- Currently: No format validation (accepts any non-empty string)

**Future Enhancement Possibilities:**
```javascript
// Stricter validation (base58/base64 format)
function isValidProcessId(id) {
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return typeof id === 'string' && 
         id.length === 43 &&  // AO process ID length
         base58Regex.test(id);
}
```

**Design Philosophy:**
- **Permissive now**: Accept any non-empty string
- **Fail at runtime**: Let API validation catch invalid IDs
- **Graceful warning**: Don't halt on single bad line
- **Future-proof**: Easy to add stricter validation later

### Error Handling

**File Access Errors:**
```javascript
try {
  const content = fs.readFileSync(filePath, 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error(`Config file not found: ${filePath}`);
  }
  throw error;  // Propagate other errors (permissions, etc.)
}
```

**Parsing Errors:**
```javascript
// No valid IDs found
if (processIds.length === 0) {
  throw new Error('No valid process IDs found in config file');
}

// Invalid line format
if (!isValidProcessId(line)) {
  console.warn(`WARNING: Invalid process ID on line ${i + 1}: "${line}"`);
  // Continue processing (non-fatal)
}
```

**Error Handling Strategy:**
- **Fatal errors**: File not found, no valid IDs → throw exception → exit 1
- **Non-fatal warnings**: Invalid line → log warning → continue
- **Downstream errors**: Invalid process ID → caught during API call → logged in results

**Error Propagation:**
```
Config Load Error
  ↓
main() catch block
  ↓
logError(null, error.message)
  ↓
process.exit(1)
```

## 7. API Integration

### State Endpoint

**URL Structure:**
```
https://state.forward.computer/{processId}/compute/at-slot
```

**Request:**
```http
GET /ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo/compute/at-slot HTTP/1.1
Host: state.forward.computer
```

**Response Format:** Plain text nonce
```
5243123
```

**Characteristics:**
- Content-Type: `text/plain`
- Single line response
- Numeric nonce value as string
- No whitespace trimming required typically

**Parsing:**
```javascript
const stateNonce = await response.text();
```

### SU Router Endpoint

**URL Structure:**
```
https://su-router.ao-testnet.xyz/{processId}/latest
```

**Request:**
```http
GET /ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo/latest HTTP/1.1
Host: su-router.ao-testnet.xyz
```

**Response Format:** JSON
```json
{
  "assignment": {
    "processes": ["ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo"],
    "message": "msg123",
    "epoch": 0,
    "timestamp": 1234567890,
    "block_height": 1000000,
    "tags": [
      { "name": "Process", "value": "ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo" },
      { "name": "Nonce", "value": "5243123" },
      { "name": "Timestamp", "value": "1234567890" }
    ]
  }
}
```

**Characteristics:**
- Content-Type: `application/json`
- Nonce embedded in tags array
- Tags are name-value pairs
- Nonce value is a string

### Nonce Extraction from assignment.tags Array

**Algorithm:**
```javascript
const data = await response.json();

const nonceTag = data.assignment.tags.find(tag => tag.name === 'Nonce');

if (!nonceTag) {
  throw new Error('Nonce tag not found in assignment');
}

const suRouterNonce = nonceTag.value;
```

**Steps:**
1. Parse JSON response body
2. Navigate to `assignment.tags` array
3. Iterate through tags using `Array.find()`
4. Match tag where `name === "Nonce"`
5. Extract `value` property
6. Validate nonce exists

**Edge Cases:**
- Missing `assignment` object → Error
- Missing `tags` array → Error
- No tag with `name: "Nonce"` → Error
- Nonce tag with empty value → Valid (empty string nonce)

## 8. Logging Strategy

### Log Format

**Single-Process Format:**
```
[TIMESTAMP] State Nonce: X | SU Router Nonce: Y | Status: MATCH/MISMATCH
```

**Multi-Process Format:**
```
[TIMESTAMP] [PROCESS_ID] State Nonce: X | SU Router Nonce: Y | Status: MATCH ✓ / MISMATCH ✗
```

**Example Outputs:**

*Single-process mode:*
```
[2025-10-03T14:30:00.123Z] State Nonce: 5243123 | SU Router Nonce: 5243123 | Status: MATCH
[2025-10-03T14:35:00.456Z] State Nonce: 5243124 | SU Router Nonce: 5243123 | Status: MISMATCH
```

*Multi-process mode:*
```
[2025-10-03T14:30:00.123Z] [ivJt7oYs...5fHo] State Nonce: 5243123 | SU Router Nonce: 5243123 | Status: MATCH ✓
[2025-10-03T14:30:00.456Z] [abc123de...stu901] State Nonce: 5243124 | SU Router Nonce: 5243123 | Status: MISMATCH ✗
[2025-10-03T14:30:00.789Z] [xyz987wv...gf210] ERROR: Failed to fetch state nonce: Network timeout

=== SUMMARY ===
Total Processes: 3
Matches: 1 ✓
Mismatches: 1 ✗
Errors: 1 ⚠
```

### Process ID Truncation Logic

**Implementation (nonce-monitor.js:11-16):**
```javascript
function truncateProcessId(processId) {
  if (processId.length <= 19) {
    return processId;
  }
  return `${processId.slice(0, 8)}...${processId.slice(-8)}`;
}
```

**Truncation Rules:**
- Process IDs ≤ 19 chars: Display full ID
- Process IDs > 19 chars: Show first 8 + `...` + last 8 chars
- Total truncated length: 19 chars (`8 + 3 + 8`)

**Examples:**
```
Input:  ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo  (43 chars)
Output: ivJt7oYs...5Fm5fHo                          (19 chars)

Input:  short123                                     (8 chars)
Output: short123                                     (8 chars - unchanged)
```

**Rationale:**
- **Readability**: Prevents log line overflow
- **Uniqueness**: First/last 8 chars usually unique enough
- **Debugging**: Enough info to identify process in logs
- **Consistency**: Fixed-width format for log parsing

### Summary Format Specification

**Structure:**
```
=== SUMMARY ===
Total Processes: {count}
Matches: {count} ✓
Mismatches: {count} ✗
Errors: {count} ⚠
```

**Field Definitions:**
- **Total Processes**: Number of process IDs in config file
- **Matches**: Processes where state nonce === SU router nonce (no errors)
- **Mismatches**: Processes where nonces differ (no errors)
- **Errors**: Processes that failed to check (network/API errors)

**Calculation Logic (nonce-monitor.js:198-203):**
```javascript
const total = results.length;
const matches = results.filter(r => r.match && !r.error).length;
const mismatches = results.filter(r => !r.match && !r.error).length;
const errors = results.filter(r => r.error).length;
```

**Invariant:** `total === matches + mismatches + errors`

**Exit Code Mapping:**
```javascript
return (errors > 0 || mismatches > 0) ? 1 : 0;
```
- Exit 0: All processes matched successfully
- Exit 1: At least one mismatch or error occurred

### ISO 8601 Timestamps

**Format Specification:**
```
YYYY-MM-DDTHH:mm:ss.sssZ
```

**Generation:**
```javascript
const timestamp = new Date().toISOString();
```

**Properties:**
- **Timezone**: Always UTC (Z suffix)
- **Precision**: Milliseconds
- **Sortable**: Lexicographically sortable
- **Standard**: RFC 3339 compliant

**Examples:**
```
2025-10-03T14:30:00.123Z
2025-10-03T09:45:32.987Z
2025-12-31T23:59:59.999Z
```

### Log Volume Considerations

**Single-Process Mode:**
- 1 log line per execution
- Size: ~100-150 bytes per log
- Frequency: Depends on cron schedule (e.g., every 5 min = 288 logs/day)
- Daily volume: ~43 KB/day at 5-minute intervals

**Multi-Process Mode:**
- (N + 6) log lines per execution
  - N individual process results
  - 1 empty line
  - 5 summary lines
- Size: ~150 bytes × N + 200 bytes (summary)
- Example: 10 processes = ~1.7 KB per execution
- Daily volume at 5-min intervals: ~490 KB/day (10 processes)

**Volume Scaling:**
```
Processes | Lines/Run | Size/Run | Size/Day (5min cron)
----------|-----------|----------|--------------------
1         | 1         | ~150 B   | 43 KB
10        | 16        | ~1.7 KB  | 490 KB
50        | 56        | ~8 KB    | 2.3 MB
100       | 106       | ~16 KB   | 4.6 MB
```

**Log Rotation Recommendations:**
- Use `logrotate` for files > 10 MB
- Compress rotated logs (achieves ~10:1 ratio for text)
- Retain 30-90 days based on compliance needs
- Consider streaming to centralized logging for large deployments

## 9. Error Handling Strategy

### Per-Process Error Isolation

**Design Principle:**
> Individual process failures should not stop execution for other processes

**Implementation (nonce-monitor.js:151-179):**
```javascript
async function checkProcess(processId) {
  try {
    const [stateNonce, suRouterNonce] = await Promise.all([
      fetchStateNonce(stateUrl),
      fetchSURouterNonce(suRouterUrl)
    ]);
    
    return {
      processId,
      stateNonce,
      suRouterNonce,
      match: String(stateNonce) === String(suRouterNonce),
      error: null  // Success case
    };
  } catch (error) {
    return {
      processId,
      stateNonce: null,
      suRouterNonce: null,
      match: false,
      error: error.message  // Captured error
    };
  }
}
```

**Isolation Guarantees:**
- Each process check wrapped in try-catch
- Errors converted to result objects
- Execution continues for remaining processes
- Failed process marked with error message
- No exception propagation to caller

### Continue-on-Error Pattern

**Loop Execution (nonce-monitor.js:181-196):**
```javascript
async function checkAllProcesses(processIds) {
  const results = [];
  
  for (const processId of processIds) {
    const result = await checkProcess(processId);  // Never throws
    results.push(result);
    
    // Log immediately (real-time feedback)
    if (result.error) {
      logError(result.processId, result.error);
    } else {
      logResult(result.processId, result.stateNonce, result.suRouterNonce);
    }
  }
  
  return results;  // Always returns complete results array
}
```

**Pattern Benefits:**
1. **Resilience**: One API failure doesn't cascade
2. **Visibility**: Errors logged immediately
3. **Completeness**: All processes always checked
4. **Debugging**: Error context preserved in results
5. **Monitoring**: Partial failures visible in summary

**Example Scenario:**
```
Process 1: ✓ Success → logged
Process 2: ✗ Network timeout → logged as error, continue
Process 3: ✓ Success → logged
Process 4: ✗ Invalid response → logged as error, continue
Process 5: ✓ Success → logged

Summary: 3 matches, 0 mismatches, 2 errors → Exit 1
```

### Summary-Based Exit Codes

**Exit Code Logic (nonce-monitor.js:198-211):**
```javascript
function generateSummary(results) {
  const total = results.length;
  const matches = results.filter(r => r.match && !r.error).length;
  const mismatches = results.filter(r => !r.match && !r.error).length;
  const errors = results.filter(r => r.error).length;
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total Processes: ${total}`);
  console.log(`Matches: ${matches} ✓`);
  console.log(`Mismatches: ${mismatches} ✗`);
  console.log(`Errors: ${errors} ⚠`);
  
  // Exit code based on overall health
  return (errors > 0 || mismatches > 0) ? 1 : 0;
}
```

**Exit Code Matrix:**

| Condition | Matches | Mismatches | Errors | Exit Code | Meaning |
|-----------|---------|------------|--------|-----------|---------|
| All healthy | N | 0 | 0 | 0 | ✓ Success |
| Nonce drift | N-1 | 1 | 0 | 1 | ✗ Mismatch detected |
| Network issues | N-1 | 0 | 1 | 1 | ⚠ Monitoring failure |
| Mixed failures | N-2 | 1 | 1 | 1 | ✗ Multiple issues |
| Total failure | 0 | 0 | N | 1 | ⚠ Complete outage |

**Monitoring Integration:**
```bash
# Cron email alert on non-zero exit
MAILTO=ops@example.com
*/5 * * * * node nonce-monitor.js

# Nagios/Icinga check
node nonce-monitor.js
if [ $? -ne 0 ]; then
  echo "CRITICAL: Nonce monitoring failures detected"
  exit 2
fi
```

### Config File Error Handling

**File Access Errors:**
```javascript
try {
  const content = fs.readFileSync(filePath, 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error(`Config file not found: ${filePath}`);
  }
  throw error;  // Permission denied, etc.
}
```

**Parsing Errors:**
```javascript
// Empty config (after filtering comments/blanks)
if (processIds.length === 0) {
  throw new Error('No valid process IDs found in config file');
}

// Invalid line (non-fatal warning)
if (!isValidProcessId(line)) {
  console.warn(`WARNING: Invalid process ID on line ${i + 1}: "${line}"`);
  // Continue processing
}
```

**Error Handling Levels:**

| Error Type | Severity | Action | Exit Code |
|------------|----------|--------|-----------|
| File not found | Fatal | Log error, exit | 1 |
| Read permission denied | Fatal | Log error, exit | 1 |
| No valid IDs | Fatal | Log error, exit | 1 |
| Invalid line format | Warning | Log warning, skip line | (continues) |
| Empty/comment line | Info | Skip silently | (continues) |

**Main Function Error Handling:**
```javascript
async function main() {
  const configFile = process.env.CONFIG_FILE || './process-ids.txt';
  
  if (fs.existsSync(configFile)) {
    try {
      const processIds = loadConfig(configFile);  // May throw
      const results = await checkAllProcesses(processIds);
      const exitCode = generateSummary(results);
      process.exit(exitCode);
    } catch (error) {
      logError(null, error.message);  // Config load failed
      process.exit(1);
    }
  } else {
    // Fallback to single-process mode
  }
}
```

### Network and HTTP Error Handling

**Timeout Handling:**
```javascript
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}
```

**HTTP Status Validation:**
```javascript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

**Parse Errors:**
```javascript
try {
  const data = await response.json();
} catch (error) {
  if (error instanceof SyntaxError) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
  throw error;
}
```

**Error Messages (user-friendly):**
- `Request timeout after 10000ms` (not: "AbortError")
- `HTTP 404: Not Found` (not: raw HTTP error)
- `Failed to parse JSON: Unexpected token` (specific context)
- `Nonce tag not found in assignment.tags` (precise location)

## 10. Performance Characteristics

### Sequential Execution Timing

**Per-Process Latency:**
- Network latency (state API): ~50-150ms
- Network latency (SU router API): ~50-150ms
- Parallel fetch of both: ~100-200ms (max of two)
- Parsing overhead: ~1-5ms
- Logging overhead: ~1-2ms
- **Total per process: ~100-210ms**

**Multi-Process Scaling:**
```
Processes | Sequential Time | Parallel Time (theoretical)
----------|-----------------|---------------------------
1         | ~150ms         | ~150ms
5         | ~750ms         | ~150ms
10        | ~1.5s          | ~150ms
50        | ~7.5s          | ~150ms
100       | ~15s           | ~150ms
```

**Why Sequential is Acceptable:**
- Monitoring runs every 5 minutes (300 seconds)
- Even 100 processes (15s) is only 5% of interval
- Predictable, linear scaling
- No risk of API rate limiting
- Clear log ordering

### Expected Latency Components

**Network Breakdown (typical):**
```
DNS lookup:        5-20ms   (cached after first)
TCP handshake:     20-50ms  (per connection)
TLS handshake:     30-80ms  (per connection)
Request/response:  20-50ms  (API processing)
-----------------------------------------
Total first call:  75-200ms
Subsequent:        40-100ms (connection reuse)
```

**API Response Times (observed):**
- State endpoint: Fast (usually <100ms)
- SU router endpoint: Moderate (~100-200ms)
- 99th percentile: ~500ms (network spikes)

**Timeout Configuration:**
```javascript
const REQUEST_TIMEOUT = 10000;  // 10 seconds
```
- Default: 10s (very conservative)
- Typical: 100-200ms (50x safety margin)
- Allows for network instability

### Scalability Limits

**Practical Limits:**

| Constraint | Limit | Reason |
|------------|-------|--------|
| **Process count** | ~1000 | Sequential timing (~2.5 min for 1000 @ 150ms each) |
| **Config file size** | ~50 KB | 1000 lines × ~50 chars/line |
| **Memory usage** | ~50 MB | Base runtime + results array |
| **Log volume** | ~100 MB/day | 1000 processes × 5-min cron |

**Execution Time Limits:**
- Cron interval: 5 minutes (300s)
- Safe process count: <1000 (sequential)
- Recommended: <100 processes per config
- For >100: Split into multiple cron jobs

**Scaling Strategies:**

*Horizontal (recommended for >100 processes):*
```bash
# Split into multiple configs
*/5 * * * * CONFIG_FILE=./prod-group-1.txt node nonce-monitor.js
*/5 * * * * CONFIG_FILE=./prod-group-2.txt node nonce-monitor.js
*/5 * * * * CONFIG_FILE=./staging.txt node nonce-monitor.js
```

*Vertical (future enhancement):*
```javascript
// Parallel execution with concurrency limit
const limit = 10;  // Max 10 concurrent requests
const results = await pMap(processIds, checkProcess, { concurrency: limit });
```

### Memory Usage Analysis

**Single-Process Mode:**
```
Node.js runtime:     ~25 MB
Script code:         ~50 KB
Fetch buffers:       ~10 KB (response bodies)
Stack/heap:          ~1 MB
-----------------------------------
Total:               ~26 MB
```

**Multi-Process Mode:**
```
Node.js runtime:     ~25 MB
Script code:         ~50 KB
Config file buffer:  ~50 KB (1000 process IDs)
Results array:       ~100 KB (1000 result objects)
Fetch buffers:       ~10 KB (per-process, sequential)
-----------------------------------
Total:               ~26 MB (no significant increase)
```

**Memory Scaling:**
- Flat base: ~25 MB (Node.js runtime)
- Per-process overhead: ~100 bytes (result object)
- 1000 processes: ~25.1 MB total
- **Conclusion: Memory is not a bottleneck**

**Resource Efficiency:**
- Process exits after completion → 0 MB between runs
- No memory leaks possible (short-lived process)
- No accumulation across executions
- Cron runs every 5 minutes: >99.9% idle time

## 11. Configuration Design

### Environment Variable Configuration

**SLACK_WEBHOOK_URL:**

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
```

**Purpose**: Slack Incoming Webhook URL for alert notifications

**Characteristics:**
- **Optional**: Script runs normally if not set (no alerts sent)
- **Validation**: Must be valid HTTPS URL (checked at runtime)
- **Security**: Never hardcoded, never logged, never committed to repository
- **Format**: Slack webhook URL (starts with `https://hooks.slack.com/services/`)

**Usage:**
```javascript
const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!webhookUrl) {
  // Skip Slack alerting (not an error)
  return;
}

if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
  console.error('Invalid SLACK_WEBHOOK_URL format');
  return;
}
```

**SLACK_ALERT_ON_ERROR (Future Enhancement):**

```bash
export SLACK_ALERT_ON_ERROR=true  # Alert on network errors, not just mismatches
```

**Configuration Matrix:**

| Scenario | SLACK_WEBHOOK_URL | Mismatches | Errors | Slack Alert Sent? |
|----------|-------------------|------------|--------|-------------------|
| **No webhook** | (not set) | 0 | 0 | ❌ No alerts |
| **Webhook + match** | Set | 0 | 0 | ❌ No alert (all healthy) |
| **Webhook + mismatch** | Set | 1+ | 0 | ✅ Batched mismatch alert |
| **Webhook + error** | Set | 0 | 1+ | ❌ No alert (future: configurable) |
| **Invalid webhook** | Invalid URL | 1+ | 0 | ❌ Error logged, no alert |

### Security Considerations

**Webhook URL Protection:**

```bash
# BAD: Hardcoded in script
const WEBHOOK_URL = "https://hooks.slack.com/services/...";  // ❌ NEVER DO THIS

# GOOD: Environment variable
const webhookUrl = process.env.SLACK_WEBHOOK_URL;  // ✅ Secure
```

**Best Practices:**

1. **Never commit webhook URL to repository**
   - Add to `.env` file
   - Add `.env` to `.gitignore`
   - Use environment-specific configuration

2. **Use environment management tools**
   ```bash
   # Production server
   echo 'export SLACK_WEBHOOK_URL="https://..."' >> ~/.bashrc
   
   # Docker
   docker run -e SLACK_WEBHOOK_URL="https://..." ...
   
   # Kubernetes
   kubectl create secret generic slack-webhook --from-literal=url="https://..."
   ```

3. **Rotate webhooks periodically**
   - Slack webhooks can be regenerated without code changes
   - Update environment variable after rotation
   - No code deployment required

4. **Restrict webhook permissions**
   - Webhook only posts to single channel
   - No read permissions
   - No ability to modify channel settings

**Logging Redaction:**

```javascript
// Never log full webhook URL
console.error(`Failed to send Slack alert`);  // ✅ Safe

// Don't log webhook in errors
console.error(`Failed to send to ${webhookUrl}`);  // ❌ Leaks secret
```

### Validation and Defaults

**Webhook URL Validation:**

```javascript
function validateWebhookUrl(url) {
  if (!url) {
    return { valid: false, reason: 'not_configured' };
  }
  
  if (typeof url !== 'string') {
    return { valid: false, reason: 'invalid_type' };
  }
  
  if (!url.startsWith('https://hooks.slack.com/')) {
    return { valid: false, reason: 'invalid_format' };
  }
  
  return { valid: true };
}
```

**Default Behavior:**

| Configuration | Default | Rationale |
|---------------|---------|-----------|
| **SLACK_WEBHOOK_URL** | (not set) | Slack is optional—core monitoring works without it |
| **Alert timeout** | 5000ms | Fast failure, doesn't block script execution |
| **Retry attempts** | 0 | Fail fast, rely on next cron run |
| **Message format threshold** | 10 mismatches | Balance between detail and compactness |

**Configuration Precedence:**

```
1. SLACK_WEBHOOK_URL environment variable (runtime)
2. Not configured → Skip Slack alerting (graceful degradation)
```

No configuration file support for webhook URL (security best practice—avoid committing secrets).

## 12. Production Considerations

### Resource Efficiency

**Runs on Demand:**
- **Memory**: Script loads, executes, exits. Zero memory consumption between runs.
- **CPU**: Active for ~100-500ms per execution. Idle 99.9%+ of the time.
- **Network**: Two HTTP requests per execution. No persistent connections.
- **File Handles**: No files opened except stdout/stderr (auto-managed by OS).

**Benchmark (typical execution):**
```
Memory Usage: ~30MB (Node.js runtime + script)
CPU Time: ~50-200ms (network I/O dependent)
Network: ~2-5KB total (request + response size)
Disk I/O: 0 bytes (no file operations)
```

**Scale Characteristics:**
- **Cron every minute**: 1440 executions/day, ~20MB-hours of memory
- **Cron every 5 minutes**: 288 executions/day, ~4MB-hours of memory
- **vs. Long-running process**: 720MB-hours (24h × 30MB continuously)

### Reliability

**System Cron Restarts:**
- Cron daemon ensures execution even after:
  - System reboots
  - Script crashes
  - Node.js runtime errors
  - Out of memory errors

**Guaranteed Execution:**
```cron
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js
```

- Cron runs independently of application state
- If script hangs, next cron execution starts fresh
- No cascading failures between runs

**Idempotency:**
- Each execution is stateless
- No shared state between runs
- Results don't depend on previous executions
- Safe to run multiple times

### Fault Tolerance

**Exit Code Strategy:**

```javascript
process.exit(0);  // MATCH or all processes successful
process.exit(1);  // Network error, parse error, config error, any mismatch
```

**Monitoring Integration:**
```bash
# Cron can email on non-zero exit
MAILTO=ops@example.com
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js || echo "Nonce monitoring failed"

# Monitoring wrapper
*/5 * * * * /usr/bin/node /path/to/nonce-monitor.js || curl -X POST https://monitor.example.com/alert
```

**Graceful Degradation:**
- Network timeout prevents indefinite hangs
- Script exits cleanly on any error
- No partial state corruption
- Next execution starts fresh

**Error Recovery:**
- Transient network errors: Resolved by next cron run
- API downtime: Automatic retry via next execution
- Invalid responses: Logged and reported via exit code

### Observability

**Structured Logs:**

```
[2025-10-03T14:30:00.123Z] [ivJt7oYs...5Fm5fHo] State Nonce: 5243123 | SU Router Nonce: 5243123 | Status: MATCH ✓
```

**Parseable Format:**
- **Timestamp**: Extractable via regex `\[(.*?)\]`
- **Process ID**: Extractable via `\[([^\]]+)\]` (second match)
- **State Nonce**: Extractable via `State Nonce: (\S+)`
- **SU Router Nonce**: Extractable via `SU Router Nonce: (\S+)`
- **Status**: Extractable via `Status: (MATCH|MISMATCH)`

**Log Analysis Examples:**

```bash
# Count mismatches in last hour
grep "Status: MISMATCH" /var/log/nonce-monitor.log | \
  awk -v cutoff="$(date -u -d '1 hour ago' +%Y-%m-%d)" '$0 > cutoff' | wc -l

# Extract nonce differences
grep "MISMATCH" /var/log/nonce-monitor.log | \
  awk -F'|' '{print $1, $2, $3}'

# Monitor error rate
tail -f /var/log/nonce-monitor.error.log | \
  while read line; do echo "ALERT: $line"; done

# Parse multi-process summary
grep "^=== SUMMARY ===" -A 4 /var/log/nonce-monitor.log | tail -5
```

**Integration with Observability Tools:**

```bash
# Prometheus node_exporter textfile collector
grep "^Total Processes:" /var/log/nonce-monitor.log | tail -1 | \
  awk '{print "nonce_monitor_total_processes " $3}' > /var/lib/node_exporter/nonce.prom

# Datadog agent
tail -f /var/log/nonce-monitor.log | \
  while read line; do
    echo "$line" | /opt/datadog-agent/bin/agent dogstatsd
  done

# CloudWatch Logs
aws logs put-log-events \
  --log-group-name nonce-monitor \
  --log-stream-name production \
  --log-events "$(cat /var/log/nonce-monitor.log)"
```

## 13. Future Enhancements

### Slack Integration Enhancements

**Interactive Slack Messages (Buttons):**

```json
{
  "text": "🚨 Nonce Mismatch Detected",
  "attachments": [
    {
      "callback_id": "nonce_mismatch_ivJt7oYs...5fHo",
      "actions": [
        {
          "name": "acknowledge",
          "text": "Acknowledge",
          "type": "button",
          "value": "acknowledged"
        },
        {
          "name": "investigate",
          "text": "Start Investigation",
          "type": "button",
          "value": "investigating",
          "url": "https://dashboard.ao.network/process/ivJt7oYs...5fHo"
        }
      ]
    }
  ]
}
```

**Benefits:**
- One-click acknowledgment of alerts
- Direct link to investigation dashboards
- Track response times and escalations

**Alert Throttling (N Consecutive Failures):**

```javascript
// Only alert after 3 consecutive mismatches (reduces false positives)
const ALERT_THRESHOLD = 3;
const consecutiveMismatches = getConsecutiveMismatches(processId);  // From DB/file

if (consecutiveMismatches >= ALERT_THRESHOLD) {
  await sendSlackAlert(mismatches);
}
```

**Use Cases:**
- Transient network issues don't trigger alerts
- Alert fatigue reduction
- Higher signal-to-noise ratio

**Per-Process Alert Channels:**

```json
{
  "processes": [
    {
      "id": "ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo",
      "slack_webhook": "https://hooks.slack.com/services/.../critical-alerts",
      "critical": true
    },
    {
      "id": "abc123def456ghi789jkl012mno345pqr678stu901",
      "slack_webhook": "https://hooks.slack.com/services/.../dev-alerts",
      "critical": false
    }
  ]
}
```

**Benefits:**
- Route critical processes to on-call channels
- Route dev/staging to development channels
- Team-specific alert routing

**Slack Slash Commands:**

```
/nonce-check ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo
→ State: 5243123 | SU Router: 5243123 | Status: MATCH ✓
```

**Implementation:**
- Requires Slack app with slash command integration
- Web server to handle Slack webhook callbacks
- On-demand process checking from Slack

**Rich Slack Blocks Formatting:**

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 Nonce Mismatch Alert"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Process ID:*\nivJt7oYs...5fHo"
        },
        {
          "type": "mrkdwn",
          "text": "*Timestamp:*\n2025-10-03 14:30:00 UTC"
        }
      ]
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*State Nonce:*\n`5243124`"
        },
        {
          "type": "mrkdwn",
          "text": "*SU Router Nonce:*\n`5243123`"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "AO Nonce Monitor | <https://dashboard.ao.network|View Dashboard>"
        }
      ]
    }
  ]
}
```

**Benefits:**
- Modern Slack UI (replaces legacy attachments)
- Better mobile rendering
- More formatting options
- Clickable links in context

### Parallel Execution with Batching

**Current: Sequential**
```javascript
for (const processId of processIds) {
  const result = await checkProcess(processId);  // One at a time
}
```

**Future: Parallel with Concurrency Limit**
```javascript
async function checkAllProcessesParallel(processIds, concurrency = 10) {
  const results = [];
  
  for (let i = 0; i < processIds.length; i += concurrency) {
    const batch = processIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(pid => checkProcess(pid))
    );
    results.push(...batchResults);
    
    batchResults.forEach(result => {
      if (result.error) {
        logError(result.processId, result.error);
      } else {
        logResult(result.processId, result.stateNonce, result.suRouterNonce);
      }
    });
  }
  
  return results;
}
```

**Benefits:**
- 10x speedup (10 concurrent vs sequential)
- Still respects API rate limits (batching)
- 100 processes: ~1.5s instead of ~15s

**Considerations:**
- API rate limiting (test safe concurrency)
- Memory usage (10 concurrent fetch buffers)
- Error handling (batch failure isolation)

### JSON Config Support

**Current: Plain Text**
```
ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo
abc123def456ghi789jkl012mno345pqr678stu901
```

**Future: JSON with Metadata**
```json
{
  "processes": [
    {
      "id": "ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo",
      "name": "Production Main Process",
      "owner": "team-alpha",
      "critical": true,
      "timeout": 5000
    },
    {
      "id": "abc123def456ghi789jkl012mno345pqr678stu901",
      "name": "Staging Test Process",
      "owner": "team-beta",
      "critical": false,
      "timeout": 10000
    }
  ]
}
```

**Enhanced Features:**
- Per-process timeout configuration
- Criticality levels (for alerting priority)
- Ownership metadata (for routing alerts)
- Process naming (for better logging)

**Auto-Detection:**
```javascript
function loadConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Detect JSON by first character
  if (content.trim().startsWith('{')) {
    return loadJSONConfig(content);
  } else {
    return loadPlainTextConfig(content);
  }
}
```

### Per-Process Timeouts

**Current: Global Timeout**
```javascript
const REQUEST_TIMEOUT = 10000;  // All processes
```

**Future: Per-Process Configuration**
```javascript
async function checkProcess(processConfig) {
  const timeout = processConfig.timeout || DEFAULT_TIMEOUT;
  
  const [stateNonce, suRouterNonce] = await Promise.all([
    fetchStateNonce(stateUrl, timeout),
    fetchSURouterNonce(suRouterUrl, timeout)
  ]);
  
  // ...
}
```

**Use Cases:**
- Critical processes: 5s timeout (fail fast)
- Best-effort processes: 30s timeout (wait longer)
- Known-slow endpoints: 20s timeout (accommodate latency)

### Result Persistence

**SQLite Storage:**
```javascript
const sqlite3 = require('sqlite3');

async function persistResults(results) {
  const db = new sqlite3.Database('./nonce-monitor.db');
  
  db.run(`
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      process_id TEXT NOT NULL,
      state_nonce TEXT,
      su_router_nonce TEXT,
      match BOOLEAN,
      error TEXT
    )
  `);
  
  const stmt = db.prepare(`
    INSERT INTO checks (timestamp, process_id, state_nonce, su_router_nonce, match, error)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  results.forEach(r => {
    stmt.run(
      new Date().toISOString(),
      r.processId,
      r.stateNonce,
      r.suRouterNonce,
      r.match,
      r.error
    );
  });
  
  stmt.finalize();
  db.close();
}
```

**Benefits:**
- Historical trend analysis
- Mismatch frequency tracking
- Error pattern detection
- SLA reporting
- Grafana/dashboard integration

**Queries:**
```sql
-- Mismatch rate over last 24 hours
SELECT 
  process_id,
  COUNT(*) as total_checks,
  SUM(CASE WHEN match = 0 AND error IS NULL THEN 1 ELSE 0 END) as mismatches,
  (SUM(CASE WHEN match = 0 AND error IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as mismatch_rate
FROM checks
WHERE timestamp > datetime('now', '-24 hours')
GROUP BY process_id;

-- Error frequency by process
SELECT process_id, COUNT(*) as error_count
FROM checks
WHERE error IS NOT NULL
  AND timestamp > datetime('now', '-7 days')
GROUP BY process_id
ORDER BY error_count DESC;
```

### Alerting Integrations

**Webhook Alerts (Slack/Discord):**
```javascript
async function sendAlert(message, severity = 'warning') {
  await fetch(process.env.WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
      severity: severity
    })
  });
}

// In checkAllProcesses:
if (mismatches > 0) {
  await sendAlert(`⚠️ ${mismatches} nonce mismatches detected`, 'warning');
}
if (errors > 0) {
  await sendAlert(`🚨 ${errors} process checks failed`, 'critical');
}
```

**PagerDuty Integration:**
```javascript
async function triggerIncident(summary, details) {
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: process.env.PAGERDUTY_KEY,
      event_action: 'trigger',
      payload: {
        summary,
        severity: 'critical',
        source: 'nonce-monitor',
        custom_details: details
      }
    })
  });
}
```

### Metrics Export (Prometheus)

**Textfile Collector Format:**
```javascript
async function exportPrometheusMetrics(results) {
  const timestamp = Date.now();
  const metrics = `
# HELP nonce_monitor_total_processes Total number of processes monitored
# TYPE nonce_monitor_total_processes gauge
nonce_monitor_total_processes ${results.length}

# HELP nonce_monitor_matches Number of processes with matching nonces
# TYPE nonce_monitor_matches gauge
nonce_monitor_matches ${results.filter(r => r.match && !r.error).length}

# HELP nonce_monitor_mismatches Number of processes with mismatched nonces
# TYPE nonce_monitor_mismatches gauge
nonce_monitor_mismatches ${results.filter(r => !r.match && !r.error).length}

# HELP nonce_monitor_errors Number of processes that failed to check
# TYPE nonce_monitor_errors gauge
nonce_monitor_errors ${results.filter(r => r.error).length}

# HELP nonce_monitor_last_run_timestamp Timestamp of last monitoring run
# TYPE nonce_monitor_last_run_timestamp gauge
nonce_monitor_last_run_timestamp ${timestamp}
`;

  await fs.promises.writeFile(
    '/var/lib/node_exporter/textfile/nonce_monitor.prom',
    metrics
  );
}
```

**PromQL Queries:**
```promql
# Mismatch rate
rate(nonce_monitor_mismatches[5m]) / rate(nonce_monitor_total_processes[5m])

# Error rate
rate(nonce_monitor_errors[5m]) / rate(nonce_monitor_total_processes[5m])

# Alerting rule
alert: HighNonceMismatchRate
expr: rate(nonce_monitor_mismatches[15m]) > 0.1
annotations:
  summary: "High nonce mismatch rate detected: {{ $value }}"
```

---

## Conclusion

This architecture provides a **production-ready, zero-dependency monitoring solution** that prioritizes:

- **Simplicity**: Single-file script with no external dependencies
- **Reliability**: System-level scheduling with automatic restarts
- **Efficiency**: Runs on-demand with minimal resource consumption
- **Observability**: Structured logging with clear error reporting
- **Scalability**: Supports both single and multi-process monitoring
- **Extensibility**: Clean design enables future enhancements

The **multi-process architecture** extends the original design with:

- **Plain text configuration**: Easy to edit, version control, and automate
- **Sequential execution**: Predictable, resource-efficient, API-friendly
- **Error isolation**: Per-process failure handling with continue-on-error pattern
- **Summary reporting**: Aggregated metrics with actionable exit codes
- **Backward compatibility**: Seamless fallback to single-process mode

The design philosophy emphasizes **doing one thing well**: comparing nonces between two endpoints and reporting the results. All architectural decisions support this core mission while maintaining operational excellence at scale.

The **Slack integration** extends observability with:

- **Batched alerting**: Single summary message per execution (reduces notification noise)
- **Native HTTPS**: Zero-dependency implementation using Node.js native `fetch` API
- **Graceful degradation**: Slack failures never impact core monitoring functionality
- **Flexible formatting**: Detailed attachments for few mismatches, compact text for many
- **Secure configuration**: Environment variable-based webhook URL (never hardcoded)
- **Error isolation**: Try-catch wrapping, timeout handling, fail-fast design

## 14. GitHub Actions Deployment Architecture

### Overview

GitHub Actions provides serverless execution of the nonce monitor without requiring dedicated infrastructure. The workflow automates periodic checks of process nonces and sends alerts on mismatches, eliminating the need for self-hosted servers.

### Deployment Model

```
GitHub Actions Workflow (Every 5 minutes)
         ↓
   Checkout Code
         ↓
   Setup Node.js 18
         ↓
   Load Secrets (PROCESS_ID, SLACK_WEBHOOK_URL)
         ↓
   Execute nonce-monitor.js
         ↓
   Capture Output → Actions Log
         ↓
   Send Slack Alert (if mismatch)
         ↓
   Set Workflow Status (success/failure)
```

**Workflow Definition (`.github/workflows/nonce-monitor.yml`):**

```yaml
name: Nonce Monitor
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
    inputs:
      process_id:
        description: 'Process ID to monitor'
        required: false

concurrency:
  group: nonce-monitor
  cancel-in-progress: false

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Run Nonce Monitor
        env:
          PROCESS_ID: ${{ secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: node nonce-monitor.js
```

### Workflow Triggers

**Scheduled Execution:**
- **Cron expression**: `*/5 * * * *` (every 5 minutes)
- **Timezone**: UTC
- **Precision**: GitHub Actions scheduled workflows may delay up to 10 minutes under high load
- **Runner**: GitHub-hosted Ubuntu runners (latest stable)

**Limitations:**
- Minimum interval: 5 minutes (GitHub Actions limitation)
- Schedule drift: Execution may delay during peak usage times
- Not suitable for sub-5-minute monitoring requirements

**Manual Execution:**
- **Trigger**: `workflow_dispatch` event
- **Use case**: Testing, debugging, or on-demand checks before scheduling
- **Input override**: Optional `process_id` parameter to override default configuration
- **Access**: Available via GitHub UI (Actions tab → Run workflow button)

**Example manual trigger:**
```bash
gh workflow run nonce-monitor.yml -f process_id=ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo
```

### Concurrency Control

**Configuration:**
```yaml
concurrency:
  group: nonce-monitor
  cancel-in-progress: false
```

**Behavior:**
- **Exclusive execution**: Only one workflow runs at a time
- **Queue management**: Subsequent triggers queue if one is running (not cancelled)
- **Race prevention**: Ensures serial execution across all triggers (scheduled + manual)
- **Resource protection**: Prevents duplicate simultaneous checks

**Comparison: cancel-in-progress Options**

| Setting | Behavior | Use Case |
|---------|----------|----------|
| `false` (current) | Queue subsequent runs | Ensure every check completes |
| `true` | Cancel queued runs | Prefer latest check only |

**Rationale for `false`:**
- Every 5-minute check is important for historical tracking
- Script execution is fast (~1-2s), queue rarely builds up
- Ensures complete monitoring coverage with no gaps

### Secret Management

**GitHub Secrets Storage:**
- **Encryption**: Secrets encrypted at rest using AES-256
- **Runtime**: Decrypted only during workflow execution in isolated runner
- **Logging**: Automatically redacted from logs (never exposed)
- **Scope**: Repository-scoped (not accessible from forks or pull requests)

**Required Secrets:**

| Secret Name | Purpose | Example Value |
|-------------|---------|---------------|
| `PROCESS_ID` | AO process to monitor | `ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo` |
| `SLACK_WEBHOOK_URL` | Slack alert destination | `https://hooks.slack.com/services/...` |

**Secret Access in Workflow:**
```yaml
env:
  PROCESS_ID: ${{ secrets.PROCESS_ID }}
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Security Features:**
- Secrets never logged (GitHub automatically masks secret values)
- Not accessible in pull requests from forks (prevents secret exfiltration)
- Audit trail available in repository settings (who added/modified secrets)
- Can be rotated without code changes (update in Settings → Secrets)

**Setting Secrets:**
```bash
# Via GitHub CLI
gh secret set PROCESS_ID --body "ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo"
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/..."

# Via GitHub UI
# Settings → Secrets and variables → Actions → New repository secret
```

### Execution Environment

**GitHub-Hosted Runner Specifications:**

| Resource | Specification | Notes |
|----------|---------------|-------|
| **Operating System** | Ubuntu Latest (22.04+) | Auto-updated by GitHub |
| **CPU** | 2 cores | x86_64 architecture |
| **RAM** | 7 GB | More than sufficient for script |
| **Disk** | 14 GB SSD | Ephemeral, cleared after run |
| **Network** | High-speed internet | Low latency to most endpoints |

**Pre-installed Software:**
- Git (latest)
- Node.js (installed by `setup-node` action)
- curl, wget (for debugging)
- Standard Linux utilities (awk, grep, sed, etc.)

**Workflow Steps Breakdown:**

1. **Checkout Code** (`actions/checkout@v4`)
   - Clones repository to runner workspace
   - Defaults to latest commit on default branch
   - Duration: ~2-5 seconds

2. **Setup Node.js** (`actions/setup-node@v4`)
   - Installs Node.js 18.x (latest stable 18)
   - Configures npm environment
   - Duration: ~5-10 seconds (cached after first run)

3. **Run Nonce Monitor** (`node nonce-monitor.js`)
   - Executes monitoring script with secrets as environment variables
   - Captures stdout/stderr to workflow log
   - Duration: ~1-2 seconds (network I/O dependent)

**Total Execution Time:** ~10-20 seconds per run

### Logging & Observability

**Workflow Logs:**
- **Real-time streaming**: Logs visible during execution in GitHub Actions UI
- **Retention**: 90 days (default, configurable up to 400 days for Enterprise)
- **Downloadable**: ZIP archive of all workflow logs available
- **Searchable**: Full-text search within Actions UI

**Log Structure:**
```
Run node nonce-monitor.js
[2025-10-03T14:30:00.123Z] State Nonce: 5243123 | SU Router Nonce: 5243123 | Status: MATCH
```

**Accessing Logs:**
```bash
# Via GitHub CLI
gh run list --workflow=nonce-monitor.yml
gh run view <run-id> --log

# Via GitHub UI
# Actions tab → Nonce Monitor workflow → Select run → View logs
```

**Metrics Available:**

| Metric | Description | Location |
|--------|-------------|----------|
| **Execution time** | Time per run (wall clock) | Workflow run summary |
| **Success/failure rate** | % of successful runs | Workflow insights |
| **Queue time** | Wait time if queued | Run details |
| **Actions minutes** | Billable compute time | Settings → Billing |

**Monitoring Dashboard:**
- **GitHub Insights**: Actions tab → Workflow insights
- **Metrics shown**: Success rate, duration percentiles, failure trends
- **Time ranges**: Last 7/14/30 days

### Workflow Summary

Each run generates a workflow summary displayed in the Actions UI. This can be enhanced with a summary step:

```yaml
- name: Generate Summary
  if: always()
  run: |
    echo "### Nonce Monitor Results 🚀" >> $GITHUB_STEP_SUMMARY
    echo "**Status:** ${{ job.status }}" >> $GITHUB_STEP_SUMMARY
    echo "**Time:** $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $GITHUB_STEP_SUMMARY
    echo "**Run ID:** ${{ github.run_id }}" >> $GITHUB_STEP_SUMMARY
```

**Summary Display:**
```markdown
### Nonce Monitor Results 🚀
**Status:** success
**Time:** 2025-10-03T12:00:00Z
**Run ID:** 123456789
```

**Benefits:**
- Quick status check without opening logs
- Shareable summary link
- Visible in PR checks (if triggered by PR events)

### Cost Model

**GitHub Actions Pricing:**

| Account Type | Free Minutes/Month | Cost After Free Tier |
|--------------|-------------------|---------------------|
| **Public repos** | Unlimited | $0 |
| **Private repos (Free)** | 2,000 minutes | N/A |
| **Private repos (Team)** | 3,000 minutes | $0.008/minute |
| **Private repos (Enterprise)** | 50,000 minutes | $0.008/minute |

**Usage Calculation:**

```
Runs per day: 24 hours × 12 runs/hour = 288 runs
Seconds per run: ~20 seconds ≈ 0.33 minutes
Daily usage: 288 × 0.33 = 95 minutes
Monthly usage: 95 × 30 = 2,850 minutes
```

**Cost Analysis:**

| Scenario | Monthly Minutes | Cost (Public) | Cost (Private Free) | Cost (Private Team) |
|----------|----------------|---------------|---------------------|---------------------|
| **5-min interval** | 2,850 | $0 | Exceeds free tier | $6.80 |
| **10-min interval** | 1,425 | $0 | Within free tier | $0 |
| **15-min interval** | 950 | $0 | Within free tier | $0 |

**Result:** 
- **Public repos**: Free unlimited
- **Private repos**: Exceeds free tier (2,000 min) at 5-min interval, requires paid plan or longer interval

**Cost Optimization Strategies:**
1. Increase interval to 10-15 minutes (stays within free tier)
2. Use public repository (unlimited free)
3. Upgrade to Team plan ($4/user/month includes 3,000 minutes)
4. Self-host runners (no minute charges, requires infrastructure)

### Comparison: GitHub Actions vs Server Cron

| Aspect | GitHub Actions | Server Cron |
|--------|----------------|-------------|
| **Infrastructure** | GitHub-hosted (serverless) | Self-hosted server required |
| **Setup Time** | 10 minutes | 1-2 hours (server + cron) |
| **Maintenance** | None (GitHub manages) | Regular OS updates, patches |
| **Logs** | Built-in UI, searchable | Manual setup (logrotate, etc.) |
| **Cost (public repo)** | $0 | $5-50/month (VPS/cloud) |
| **Cost (private repo)** | $6.80/month (5-min interval) | $5-50/month |
| **Minimum Interval** | 5 minutes | Any interval (even 1 second) |
| **Reliability** | 99.9% SLA (GitHub uptime) | Depends on server/provider |
| **Updates** | `git push` (instant) | SSH + deploy script |
| **Scalability** | Automatic (GitHub scales) | Manual (upgrade server) |
| **Observability** | GitHub Actions UI | Custom (Grafana, CloudWatch, etc.) |

**Recommendation Matrix:**

| Requirement | Recommended Solution |
|-------------|---------------------|
| Public repo + any interval | GitHub Actions ✓ |
| Private repo + 10-min interval | GitHub Actions ✓ |
| Private repo + 5-min interval + low budget | Server Cron ✓ |
| Sub-5-minute monitoring | Server Cron ✓ (Actions can't do this) |
| No infrastructure management | GitHub Actions ✓ |
| Need for custom environment | Server Cron ✓ |

### Limitations

**Schedule Limitations:**
- **Minimum interval**: 5 minutes (GitHub Actions limitation, cannot go lower)
- **Schedule drift**: May delay up to 10 minutes during high GitHub load
- **No sub-minute**: Not suitable for sub-minute monitoring requirements
- **Cron syntax**: Standard cron, but only 5-minute minimum enforced

**Execution Limits:**
- **Max run time**: 6 hours per workflow run (far exceeds script needs)
- **API rate limits**: 1,000 API requests per hour per repository
- **Concurrency**: 20 concurrent jobs for free tier, 180 for paid
- **Workflow file size**: 20 KB max (current workflow is ~1 KB)

**Storage Limits:**
- **Workflow logs**: 90 days retention (default, configurable)
- **Artifacts**: 500 MB per repository (for file uploads)
- **No persistent state**: Cannot persist state between runs without external storage

**Other Constraints:**
- No persistent filesystem (runner wiped after each run)
- Cannot run interactive commands
- No custom runner configurations on free tier
- Secrets limited to 64 KB per secret

### When to Use GitHub Actions

**Ideal For:**
- ✅ **Public repositories** (unlimited free minutes)
- ✅ **Teams without infrastructure** (no servers to manage)
- ✅ **5-minute or longer intervals** (meets scheduling requirements)
- ✅ **Quick setup requirements** (10 minutes to deploy)
- ✅ **Version-controlled deployment** (workflow file in git)
- ✅ **Built-in observability** (GitHub Actions UI for logs/metrics)

**Not Ideal For:**
- ❌ **Sub-5-minute monitoring** (GitHub Actions can't support)
- ❌ **Private repos with high frequency** (exceeds free tier, costly)
- ❌ **Need for persistent state** (no filesystem persistence)
- ❌ **Custom execution environment** (limited runner customization)
- ❌ **Network-restricted environments** (runners on public internet)

**Decision Tree:**

```
Need sub-5-minute monitoring?
  YES → Use Server Cron
  NO ↓

Public repository?
  YES → Use GitHub Actions ✓
  NO ↓

Private repo + 10-min interval acceptable?
  YES → Use GitHub Actions ✓
  NO ↓

Budget >$7/month?
  YES → Use GitHub Actions (paid tier)
  NO → Use Server Cron
```

### Migration Path

**From Cron to GitHub Actions:**

1. **Push code to GitHub**
   ```bash
   git init
   git add nonce-monitor.js
   git commit -m "Add nonce monitor script"
   git remote add origin https://github.com/user/repo.git
   git push -u origin main
   ```

2. **Configure secrets in GitHub**
   ```bash
   gh secret set PROCESS_ID --body "ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo"
   gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/..."
   ```

3. **Create workflow file**
   ```bash
   mkdir -p .github/workflows
   # Create nonce-monitor.yml (as shown above)
   git add .github/workflows/nonce-monitor.yml
   git commit -m "Add GitHub Actions workflow"
   git push
   ```

4. **Test with manual trigger**
   ```bash
   gh workflow run nonce-monitor.yml
   gh run watch  # Watch execution
   ```

5. **Disable cron job** (once validated)
   ```bash
   crontab -e
   # Comment out: # */5 * * * * node /path/to/nonce-monitor.js
   ```

6. **Monitor GitHub Actions execution**
   - Check Actions tab for scheduled runs
   - Verify Slack alerts working
   - Monitor for 24-48 hours before fully decommissioning server

**From GitHub Actions to Cron:**

1. **Set up server with cron**
   ```bash
   ssh server.example.com
   git clone https://github.com/user/repo.git
   cd repo
   ```

2. **Deploy code and configure environment**
   ```bash
   export PROCESS_ID="ivJt7oYsNNPTAhmLDOZAKIlPm0VbXUQR1sF74Fm5fHo"
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
   echo 'export PROCESS_ID="..."' >> ~/.bashrc
   echo 'export SLACK_WEBHOOK_URL="..."' >> ~/.bashrc
   ```

3. **Test cron execution**
   ```bash
   node nonce-monitor.js  # Verify works
   ```

4. **Configure cron**
   ```bash
   crontab -e
   # Add: */5 * * * * cd /home/user/repo && node nonce-monitor.js >> /var/log/nonce-monitor.log 2>&1
   ```

5. **Disable GitHub Actions workflow** (once cron validated)
   ```bash
   # Comment out schedule trigger in .github/workflows/nonce-monitor.yml
   git commit -m "Disable GitHub Actions schedule (migrated to cron)"
   git push
   ```

### Future Enhancements

**Workflow Artifacts for Log Storage:**
```yaml
- name: Upload Logs
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: nonce-monitor-logs
    path: /tmp/nonce-monitor.log
    retention-days: 30
```

**Benefits:**
- Persist logs beyond 90-day limit
- Downloadable failure logs for debugging
- Attach to issues for troubleshooting

**Matrix Strategy for Multiple Networks:**
```yaml
strategy:
  matrix:
    network:
      - mainnet
      - testnet
      - devnet
jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Run Monitor
        env:
          NETWORK: ${{ matrix.network }}
          PROCESS_ID: ${{ secrets[format('PROCESS_ID_{0}', matrix.network)] }}
        run: node nonce-monitor.js
```

**Benefits:**
- Monitor multiple networks in parallel
- Network-specific configuration
- Isolated failure tracking per network

**Custom Action for Reusability:**
```yaml
# .github/actions/nonce-monitor/action.yml
name: 'Nonce Monitor'
description: 'Check AO process nonce synchronization'
inputs:
  process_id:
    description: 'Process ID to monitor'
    required: true
  slack_webhook_url:
    description: 'Slack webhook for alerts'
    required: false
runs:
  using: 'node18'
  main: 'index.js'
```

**Usage:**
```yaml
- uses: ./.github/actions/nonce-monitor
  with:
    process_id: ${{ secrets.PROCESS_ID }}
    slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Benefits:**
- Reusable across multiple workflows
- Easier to maintain (single source of truth)
- Can publish to GitHub Marketplace

**Status Dashboard Integration:**
```yaml
- name: Update Status Page
  if: failure()
  run: |
    curl -X POST https://status.example.com/api/incidents \
      -H "Authorization: Bearer ${{ secrets.STATUS_API_KEY }}" \
      -d '{"title":"Nonce Mismatch Detected","status":"investigating"}'
```

**Benefits:**
- Public status page updates on failures
- Customer-facing incident tracking
- Integration with status providers (StatusPage, Atlassian, etc.)

---

**Summary of GitHub Actions Architecture:**

GitHub Actions provides a **serverless, zero-infrastructure deployment** for nonce monitoring with:

- **Automated scheduling**: Cron-based execution every 5 minutes (configurable)
- **Secure secrets**: GitHub-encrypted storage for sensitive configuration
- **Built-in logging**: Searchable, retainable workflow logs with no setup
- **Cost-effective**: Free for public repos, low-cost for private repos
- **Easy maintenance**: Updates via `git push`, no server management

**Trade-offs vs. Server Cron:**
- **Pros**: No infrastructure, instant setup, built-in observability
- **Cons**: 5-minute minimum interval, may exceed free tier for private repos

**Best fit**: Teams wanting quick deployment without infrastructure management, acceptable with 5-minute monitoring intervals.
