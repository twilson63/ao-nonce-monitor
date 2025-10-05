# PagerDuty Integration Setup

## Overview

PagerDuty integration enables critical incident management for nonce-monitor alerts. When processes fall behind the scheduler or encounter errors, PagerDuty creates incidents that:

- Trigger escalation policies and on-call notifications
- Deduplicate recurring issues to prevent alert spam
- Auto-resolve when processes catch up
- Provide incident tracking and analytics
- Integrate with your existing on-call workflows

This integration uses the PagerDuty Events API v2 to send alerts alongside (or instead of) Slack notifications.

## Prerequisites

- PagerDuty account (free or paid tier)
- A PagerDuty service created (or permission to create one)
- Basic understanding of PagerDuty concepts:
  - **Service**: A monitored system or application
  - **Incident**: An alert requiring attention
  - **Routing Key**: API credential for sending events to a service
  - **Deduplication**: Grouping related alerts into a single incident

## Quick Start

Follow these 5 steps to get PagerDuty alerts working:

### 1. Create or Select a PagerDuty Service

If you don't have a service yet:

1. Log into [PagerDuty](https://app.pagerduty.com)
2. Navigate to **Services** → **Service Directory**
3. Click **+ New Service**
4. Enter a name (e.g., "AO Nonce Monitor")
5. Configure escalation policy and urgency settings
6. Click **Create Service**

### 2. Add Events API v2 Integration

1. Open your service (or navigate to the service details page)
2. Click the **Integrations** tab
3. Click **+ Add Integration** or **Add an integration**
4. Search for "Events API v2" or select it from the list
5. Click **Add**

### 3. Copy the Routing Key

After adding the integration, you'll see:

```
Integration Key: R0123456789ABCDEFGHIJKLMNOPQR
```

**⚠️ Security Warning**: Treat this routing key like a password. Anyone with this key can create incidents in your PagerDuty service.

Copy this key - you'll need it in the next step.

### 4. Configure Environment Variables

Add to your `.env` file:

```bash
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR
PAGERDUTY_SEVERITY_THRESHOLD=50
PAGERDUTY_AUTO_RESOLVE=true
```

See [Configuration](#configuration) section for details on each variable.

### 5. Test Your Integration

Run the test script to verify configuration:

```bash
node test-pagerduty.js
```

Or trigger a test alert by running the monitor with an intentionally low threshold:

```bash
PAGERDUTY_SEVERITY_THRESHOLD=0 node nonce-monitor.js
```

Check your PagerDuty service - you should see a test incident appear.

## Configuration

### Environment Variables

#### `PAGERDUTY_ENABLED`

**Type**: Boolean (string)  
**Default**: `false`  
**Required**: No

Enable or disable PagerDuty alerting. Set to `true` to enable.

```bash
PAGERDUTY_ENABLED=true   # Enable PagerDuty alerts
PAGERDUTY_ENABLED=false  # Disable PagerDuty alerts (default)
```

When disabled, the monitor will not send events to PagerDuty, even if other PagerDuty variables are configured.

#### `PAGERDUTY_ROUTING_KEY`

**Type**: String  
**Default**: None  
**Required**: Yes (when enabled)

Your PagerDuty service's Events API v2 routing key (also called Integration Key).

```bash
PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR
```

**⚠️ Keep this secret!** Do not commit to version control.

#### `PAGERDUTY_SEVERITY_THRESHOLD`

**Type**: Integer  
**Default**: `50`  
**Required**: No

Minimum number of slots behind scheduler to trigger a PagerDuty alert.

```bash
PAGERDUTY_SEVERITY_THRESHOLD=50   # Alert when ≥50 slots behind (default)
PAGERDUTY_SEVERITY_THRESHOLD=100  # Alert when ≥100 slots behind
PAGERDUTY_SEVERITY_THRESHOLD=10   # Alert when ≥10 slots behind (more sensitive)
```

**Note**: Slack alerts have a separate threshold configuration. You can configure different thresholds for each channel.

#### `PAGERDUTY_AUTO_RESOLVE`

**Type**: Boolean (string)  
**Default**: `true`  
**Required**: No

Automatically resolve incidents when processes catch up with the scheduler.

```bash
PAGERDUTY_AUTO_RESOLVE=true   # Auto-resolve incidents (default)
PAGERDUTY_AUTO_RESOLVE=false  # Require manual resolution
```

When enabled, incidents are automatically resolved on the next successful check where the process is caught up.

### Configuration Examples

#### PagerDuty Only (No Slack)

Send alerts only to PagerDuty:

```bash
# Disable Slack
SLACK_WEBHOOK_URL=

# Enable PagerDuty
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR
PAGERDUTY_SEVERITY_THRESHOLD=50
```

#### Both PagerDuty and Slack

Send alerts to both channels:

```bash
# Slack configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty configuration
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR
PAGERDUTY_SEVERITY_THRESHOLD=50
```

#### Different Severity Thresholds

Critical issues to PagerDuty, all issues to Slack:

```bash
# Slack gets all alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty only gets critical alerts
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR
PAGERDUTY_SEVERITY_THRESHOLD=100
```

#### Manual Resolution Only

Disable auto-resolution to require manual incident acknowledgment:

```bash
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR
PAGERDUTY_SEVERITY_THRESHOLD=50
PAGERDUTY_AUTO_RESOLVE=false
```

## Getting Your Routing Key

### Detailed Steps with Visual Guide

#### Step 1: Log into PagerDuty

Navigate to [https://app.pagerduty.com](https://app.pagerduty.com) and sign in to your account.

#### Step 2: Navigate to Your Service

- Click **Services** in the top navigation bar
- Select **Service Directory** from the dropdown
- Click on the service you want to integrate with (e.g., "AO Nonce Monitor")

Alternatively, if creating a new service:
- Click **+ New Service** button
- Fill in service details and click **Create Service**

#### Step 3: Open Integrations Tab

On the service details page, click the **Integrations** tab in the service menu.

#### Step 4: Add Events API v2 Integration

- Click **+ Add Integration** or **Add an integration** button
- In the integration search box, type "Events API v2"
- Select **Events API v2** from the results
- Click **Add** or **Add Integration**

#### Step 5: Copy the Integration Key

After adding the integration, you'll see:

```
Events API v2

Integration Key: R0123456789ABCDEFGHIJKLMNOPQR
Integration URL: https://events.pagerduty.com/v2/enqueue
```

Click the **Copy** icon next to the Integration Key or manually select and copy the key.

This is your `PAGERDUTY_ROUTING_KEY`.

### Integration Key vs Routing Key

**They're the same thing!** PagerDuty calls it:
- "Integration Key" in the UI
- "Routing Key" in the API documentation
- Use either term - both refer to the same credential

## Testing Your Integration

### Using the Test Suite

The project includes a comprehensive test suite:

```bash
node test-pagerduty.js
```

This tests:
- Configuration parsing
- Deduplication key generation
- Payload structure
- State file persistence
- Mock API calls

**Note**: These tests do NOT send real events to PagerDuty.

### Manual Testing

#### Test 1: Verify Configuration

Check that environment variables are loaded correctly:

```bash
node -e "
require('dotenv').config();
const pd = require('./lib/pagerduty');
const config = pd.getConfigFromEnv();
console.log('Enabled:', config.enabled);
console.log('Routing key present:', config.routingKey ? 'Yes' : 'No');
console.log('Threshold:', config.threshold);
console.log('Auto-resolve:', config.autoResolve);
"
```

Expected output:
```
Enabled: true
Routing key present: Yes
Threshold: 50
Auto-resolve: true
```

#### Test 2: Send Test Event

Create a test script `test-pd-event.js`:

```javascript
require('dotenv').config();
const pagerduty = require('./lib/pagerduty');

async function testAlert() {
  const config = pagerduty.getConfigFromEnv();
  
  const testIncident = {
    processId: 'test-process-123',
    stateNonce: '100',
    suRouterNonce: '200',
    type: 'mismatch'
  };
  
  const results = await pagerduty.sendPagerDutyEvent(
    [testIncident],
    'trigger',
    config
  );
  
  console.log('Results:', results);
}

testAlert();
```

Run:
```bash
node test-pd-event.js
```

Expected output:
```
[2025-10-05T12:34:56.789Z] PagerDuty event sent: trigger for test-process-123
Results: [ { processId: 'test-process-123', success: true, action: 'trigger' } ]
```

#### Test 3: Verify in PagerDuty UI

1. Go to [https://app.pagerduty.com](https://app.pagerduty.com)
2. Navigate to **Incidents**
3. Look for an incident titled: "Process test-process-123 is 100 slots behind scheduler"
4. Click the incident to view details

Custom details should include:
- Process ID: `test-process-123`
- State Nonce: `100`
- SU Router Nonce: `200`
- Slots Behind: `100`

#### Test 4: Clean Up Test Incidents

After testing, resolve the test incident:

1. Open the incident in PagerDuty
2. Click **Resolve**
3. Add a note: "Test incident"
4. Confirm resolution

Or resolve via API:

```javascript
const testIncident = {
  processId: 'test-process-123',
  type: 'mismatch'
};

await pagerduty.sendPagerDutyEvent(
  [testIncident],
  'resolve',
  config
);
```

## Incident Lifecycle

### Deduplication Keys

PagerDuty uses deduplication keys to group related alerts into a single incident. The nonce-monitor generates dedup keys in this format:

```
nonce-monitor-{type}-{processId}-{YYYYMMDD}
```

**Examples**:
```
nonce-monitor-mismatch-abc123def456-20251005
nonce-monitor-error-abc123def456-20251005
```

**Components**:
- `nonce-monitor`: Fixed prefix identifying this monitoring system
- `{type}`: Alert type - either `mismatch` or `error`
- `{processId}`: The process ID being monitored
- `{YYYYMMDD}`: Current date (for daily rotation)

### When New Incidents Are Created

A **new incident** is created when:

1. A process falls ≥ threshold slots behind, AND
2. No open incident exists with the same dedup key (same process/type/day)

**Example**:
- 10:00 AM: Process ABC falls 60 slots behind → Creates incident
- 10:05 AM: Same process still 65 slots behind → Updates existing incident (no new incident)
- 10:10 AM: Same process still 70 slots behind → Updates existing incident (no new incident)

### When Incidents Auto-Resolve

If `PAGERDUTY_AUTO_RESOLVE=true`, incidents automatically resolve when:

1. The process catches up (slots behind < threshold), AND
2. An open incident exists with matching dedup key

**Example**:
- 10:00 AM: Process ABC falls 60 slots behind → Creates incident
- 10:05 AM: Process ABC catches up (0 slots behind) → Resolves incident
- 10:10 AM: Process ABC still caught up → No action (incident already resolved)

### Daily Rotation of Dedup Keys

Deduplication keys include the date (`YYYYMMDD`), which means:

- **Same day**: Multiple alerts for the same process/type update one incident
- **Next day**: New alert creates a new incident (fresh dedup key)

**Example**:
```
Oct 5:  nonce-monitor-mismatch-abc123-20251005  → Incident A
Oct 5:  (same process alert again)              → Updates Incident A
Oct 6:  nonce-monitor-mismatch-abc123-20251006  → Incident B (new day, new incident)
```

This prevents stale incidents from accumulating while ensuring fresh visibility each day.

### State File Management

The monitor maintains a state file (`.pagerduty-state.json`) to track:
- Active incidents
- Last alert timestamps
- Deduplication keys

**Example state file**:
```json
{
  "abc123def456": {
    "dedupKey": "nonce-monitor-mismatch-abc123def456-20251005",
    "alertedAt": "2025-10-05T10:00:00.000Z",
    "severity": "error"
  }
}
```

The state file enables:
- Auto-resolution tracking
- Deduplication across monitor runs
- Incident lifecycle management

## GitHub Actions Integration

### Adding to Repository Secrets

Add your PagerDuty routing key as a GitHub repository secret:

#### Via GitHub UI

1. Navigate to your repository on GitHub
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add:
   - Name: `PAGERDUTY_ROUTING_KEY`
   - Value: `R0123456789ABCDEFGHIJKLMNOPQR`
6. Click **Add secret**

Optional secrets:
- `PAGERDUTY_SEVERITY_THRESHOLD` (default: 50)

#### Via GitHub CLI

```bash
# Add routing key
gh secret set PAGERDUTY_ROUTING_KEY --body "R0123456789ABCDEFGHIJKLMNOPQR"

# Add custom threshold (optional)
gh secret set PAGERDUTY_SEVERITY_THRESHOLD --body "100"

# Verify secrets
gh secret list
```

### Workflow Configuration

Add PagerDuty environment variables to your workflow YAML:

```yaml
name: Monitor Process with PagerDuty

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run monitor
        env:
          PROCESS_ID: ${{ secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          PAGERDUTY_ENABLED: true
          PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
          PAGERDUTY_SEVERITY_THRESHOLD: ${{ secrets.PAGERDUTY_SEVERITY_THRESHOLD || 50 }}
          PAGERDUTY_AUTO_RESOLVE: true
        run: node nonce-monitor.js
```

**Key points**:
- `PAGERDUTY_ENABLED: true` is hardcoded (you want it enabled in GitHub Actions)
- Routing key comes from secrets (secure)
- Threshold uses secret or defaults to 50
- Auto-resolve can be hardcoded or made configurable

### Example: Multi-Process Monitoring

```yaml
name: Monitor Multiple Processes (PagerDuty)

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run nonce monitor
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          PAGERDUTY_ENABLED: true
          PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
          PAGERDUTY_SEVERITY_THRESHOLD: 100
          PAGERDUTY_AUTO_RESOLVE: true
        run: node nonce-monitor.js
```

Processes are read from `process-ids.txt` in the repository.

## Troubleshooting

### "Missing routing key" Error

**Symptom**:
```
[2025-10-05T12:00:00.000Z] ERROR: PAGERDUTY_ROUTING_KEY not configured
```

**Solutions**:

1. **Check environment variable is set**:
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.PAGERDUTY_ROUTING_KEY ? 'Set' : 'Not set')"
   ```

2. **Verify .env file format** (no spaces around `=`):
   ```bash
   PAGERDUTY_ROUTING_KEY=R0123456789ABCDEFGHIJKLMNOPQR  # Correct
   PAGERDUTY_ROUTING_KEY = R0123456789ABCDEFGHIJKLMNOPQR  # Wrong (spaces)
   ```

3. **Check GitHub Actions secret**:
   ```bash
   gh secret list
   ```
   Ensure `PAGERDUTY_ROUTING_KEY` appears in the list.

4. **Verify workflow YAML references the secret**:
   ```yaml
   env:
     PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
   ```

### Incidents Not Appearing in PagerDuty

**Symptom**: Monitor logs show events sent, but no incidents appear in PagerDuty UI.

**Solutions**:

1. **Check routing key is correct**:
   - Log into PagerDuty
   - Navigate to your service → Integrations
   - Verify the Integration Key matches your `PAGERDUTY_ROUTING_KEY`

2. **Verify service is not paused**:
   - Open your PagerDuty service
   - Check for a "Paused" or "Disabled" status
   - Enable the service if needed

3. **Check severity threshold**:
   - Incidents only created when slots behind ≥ threshold
   - Lower threshold temporarily for testing:
     ```bash
     PAGERDUTY_SEVERITY_THRESHOLD=0 node nonce-monitor.js
     ```

4. **Review PagerDuty service event log**:
   - Service page → Integrations tab → Events API v2 → Recent events
   - Look for rejected or failed events

### Duplicate Incidents

**Symptom**: Multiple incidents created for the same process on the same day.

**Possible Causes**:

1. **State file not persisting** (GitHub Actions):
   - Solution: Commit state file after each run (see Advanced Usage)

2. **Dedup key mismatch**:
   - Check logs for dedup keys being generated
   - Ensure `generateDedupKey()` is consistent

3. **Different alert types** (mismatch vs error):
   - This is expected - different types create separate incidents
   - Dedup keys include type: `nonce-monitor-mismatch-...` vs `nonce-monitor-error-...`

**Debug Steps**:
```bash
# Check current state file
cat .pagerduty-state.json

# Watch dedup keys being generated
node -e "
const pd = require('./lib/pagerduty');
console.log(pd.generateDedupKey('abc123', 'mismatch'));
console.log(pd.generateDedupKey('abc123', 'error'));
"
```

### Auto-Resolution Not Working

**Symptom**: Incidents remain open even after processes catch up.

**Solutions**:

1. **Verify auto-resolve is enabled**:
   ```bash
   PAGERDUTY_AUTO_RESOLVE=true  # Should be true, not false
   ```

2. **Check that monitor runs after recovery**:
   - Auto-resolve only happens on the next monitor run
   - If monitor runs every 5 minutes, resolution can take up to 5 minutes after recovery

3. **Verify process actually caught up**:
   - Check monitor logs for nonce values
   - Ensure slots behind < threshold

4. **Inspect state file**:
   ```bash
   cat .pagerduty-state.json
   ```
   Should contain the process ID with its dedup key

5. **Manual resolution**:
   - If auto-resolve fails, resolve manually in PagerDuty UI
   - Or send resolve event manually:
     ```javascript
     await pagerduty.sendPagerDutyEvent(
       [{processId: 'abc123', type: 'mismatch'}],
       'resolve',
       config
     );
     ```

### API Rate Limits

**Symptom**:
```
HTTP 429: Rate limit exceeded
```

**PagerDuty Rate Limits**:
- Events API v2: 120 requests per minute per integration
- Unlikely to hit with normal monitoring (even at 5-minute intervals)

**Solutions**:

1. **Reduce check frequency** if monitoring many processes
2. **Batch incidents** in a single API call (already implemented in lib/pagerduty.js)
3. **Contact PagerDuty support** for rate limit increase

### Network Timeouts

**Symptom**:
```
Failed to send PagerDuty event: Request timeout after 5000ms
```

**Solutions**:

1. **Check network connectivity**:
   ```bash
   curl -I https://events.pagerduty.com/v2/enqueue
   ```

2. **Firewall or proxy issues**:
   - Ensure outbound HTTPS to `events.pagerduty.com` is allowed
   - Configure proxy if needed

3. **Timeout is too low**:
   - Default is 5000ms (5 seconds)
   - Increase if needed in `lib/pagerduty.js:78`

4. **PagerDuty service degradation**:
   - Check [PagerDuty Status](https://status.pagerduty.com)

## Best Practices

### 1. Severity Threshold Tuning

**Start conservative, then tighten**:

```bash
# Week 1: Only critical issues
PAGERDUTY_SEVERITY_THRESHOLD=100

# Week 2: After understanding normal behavior
PAGERDUTY_SEVERITY_THRESHOLD=75

# Week 3: Final tuning
PAGERDUTY_SEVERITY_THRESHOLD=50
```

**Separate thresholds for PagerDuty vs Slack**:
- **PagerDuty**: Only critical issues requiring immediate response (≥100 slots)
- **Slack**: All issues for visibility (≥50 slots or even ≥10 slots)

### 2. Escalation Policy Setup

Configure appropriate escalation in PagerDuty:

1. Navigate to **People** → **Escalation Policies**
2. Create or edit your policy
3. Recommended structure:
   - **Level 1**: Primary on-call (immediate notification)
   - **Level 2**: Secondary on-call (escalate after 15 min)
   - **Level 3**: Engineering manager (escalate after 30 min)

### 3. On-Call Scheduling

Set up rotation schedules:

1. Navigate to **People** → **Schedules**
2. Create a schedule with appropriate rotation (daily, weekly, etc.)
3. Assign schedule to your escalation policy
4. Test with override to verify notifications work

### 4. Alert Fatigue Prevention

**Avoid excessive alerts**:

- Use appropriate thresholds (not too sensitive)
- Enable auto-resolution (reduces manual toil)
- Daily dedup key rotation (fresh incidents each day)
- Monitor false-positive rate and adjust

**Signal vs Noise**:
```bash
# Too noisy (alerts on minor fluctuations)
PAGERDUTY_SEVERITY_THRESHOLD=5

# Better (only alerts on significant issues)
PAGERDUTY_SEVERITY_THRESHOLD=50

# Best (critical issues only for PagerDuty, lower threshold for Slack)
PAGERDUTY_SEVERITY_THRESHOLD=100
SLACK_THRESHOLD=25  # If supported
```

### 5. State File Management

**Local development**:
```bash
# Add to .gitignore
echo ".pagerduty-state.json" >> .gitignore
```

**GitHub Actions** (optional persistence):
```yaml
- name: Commit state file
  if: always()
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add .pagerduty-state.json
    git diff --quiet && git diff --staged --quiet || git commit -m "Update PagerDuty state"
    git push
```

**Production servers**:
- Ensure state file has appropriate permissions
- Back up periodically if tracking critical state
- Monitor file size (should stay small, <10KB for 100s of processes)

### 6. Testing in Staging

Before deploying to production:

1. Create a separate PagerDuty service for testing
2. Use a different routing key in staging `.env`
3. Test with intentionally low thresholds
4. Verify deduplication, auto-resolution, and alert content
5. Only then deploy to production

### 7. Monitoring the Monitor

Track monitor health:

- Set up dead-man switch (alert if monitor doesn't run for X hours)
- Monitor state file corruption (logs warn on corrupted files)
- Track PagerDuty API success rate in logs
- Review incident patterns weekly

## Advanced Usage

### Multiple PagerDuty Services

Route different processes to different services:

```javascript
const pdConfig1 = {
  routingKey: 'R01111111111111111111111111111',
  threshold: 50,
  enabled: true
};

const pdConfig2 = {
  routingKey: 'R02222222222222222222222222222',
  threshold: 100,
  enabled: true
};

if (processIsCritical) {
  await pagerduty.sendPagerDutyEvent([incident], 'trigger', pdConfig1);
} else {
  await pagerduty.sendPagerDutyEvent([incident], 'trigger', pdConfig2);
}
```

### Custom Severity Mapping

Modify severity based on slots behind in `lib/pagerduty.js:40`:

```javascript
const diff = Math.abs(parseInt(incident.stateNonce) - parseInt(incident.suRouterNonce));

let severity;
if (diff >= 200) {
  severity = 'critical';
} else if (diff >= 100) {
  severity = 'error';
} else if (diff >= 50) {
  severity = 'warning';
} else {
  severity = 'info';
}
```

### Integration with Other Monitors

The `lib/pagerduty.js` module is reusable across monitors:

```javascript
const pagerduty = require('./lib/pagerduty');

async function monitorGitHubActions() {
  const failures = await checkWorkflowRuns();
  
  if (failures.length > 0) {
    const config = pagerduty.getConfigFromEnv();
    
    const incidents = failures.map(f => ({
      processId: f.workflowId,
      error: f.errorMessage,
      type: 'error'
    }));
    
    await pagerduty.sendPagerDutyEvent(incidents, 'trigger', config);
  }
}
```

### State File Cleanup

Automatically remove old state entries:

```javascript
function cleanupOldState(state) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  for (const [processId, data] of Object.entries(state)) {
    const dedupKeyDate = data.dedupKey.slice(-8);
    
    if (dedupKeyDate < today) {
      delete state[processId];
    }
  }
  
  return state;
}

const state = pagerduty.loadState('.pagerduty-state.json');
const cleaned = cleanupOldState(state);
pagerduty.saveState('.pagerduty-state.json', cleaned);
```

## API Reference

### PagerDuty Events API v2

**Official Documentation**:  
[https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)

**Endpoint**:  
```
POST https://events.pagerduty.com/v2/enqueue
```

**Event Actions**:
- `trigger`: Create a new incident or update an existing one
- `acknowledge`: Acknowledge an incident
- `resolve`: Resolve an incident

**Severity Levels**:
- `critical`: Requires immediate attention
- `error`: Needs attention soon
- `warning`: Should be looked at
- `info`: Informational only

**Deduplication**:
Events with the same `dedup_key` update the same incident instead of creating duplicates.

**Rate Limits**:
- 120 requests per minute per integration
- Burst limit: 240 requests

### Module Reference

**Functions exported by `lib/pagerduty.js`**:

#### `sendPagerDutyEvent(incidents, eventAction, config)`

Send event(s) to PagerDuty.

**Parameters**:
- `incidents` (Array): Array of incident objects
- `eventAction` (String): 'trigger', 'acknowledge', or 'resolve'
- `config` (Object): Configuration object from `getConfigFromEnv()`

**Returns**: Promise<Array> - Results for each incident

#### `generateDedupKey(processId, type)`

Generate deduplication key.

**Parameters**:
- `processId` (String): Process identifier
- `type` (String): 'mismatch' or 'error'

**Returns**: String - Deduplication key

#### `loadState(stateFile)`

Load state from JSON file.

**Parameters**:
- `stateFile` (String): Path to state file

**Returns**: Object - State object (empty if file missing/corrupt)

#### `saveState(stateFile, state)`

Save state to JSON file.

**Parameters**:
- `stateFile` (String): Path to state file
- `state` (Object): State object to save

#### `getConfigFromEnv()`

Extract configuration from environment variables.

**Returns**: Object - Configuration object with routingKey, enabled, threshold, autoResolve

## Support

### PagerDuty Resources

- [PagerDuty Help Center](https://support.pagerduty.com)
- [Events API v2 Documentation](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)
- [PagerDuty Status](https://status.pagerduty.com)
- [Community Forum](https://community.pagerduty.com)

### This Monitor

- Check the main [README.md](README.md)
- Review [SLACK_SETUP.md](SLACK_SETUP.md) for Slack integration
- Review [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) for GitHub Actions
- Review implementation in `lib/pagerduty.js`
- Run test suite: `node test-pagerduty.js`

---

**Security Reminder**: Never commit your `PAGERDUTY_ROUTING_KEY` to version control. Always use environment variables or GitHub secrets. Treat routing keys like passwords - anyone with access can create incidents in your PagerDuty service.
