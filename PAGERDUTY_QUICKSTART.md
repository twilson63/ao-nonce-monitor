# PagerDuty Integration - Quick Start Guide

## 5-Minute Setup

### Prerequisites
- PagerDuty account (free tier works)
- Node.js environment

### Step 1: Get Your Routing Key (2 minutes)

1. Log into PagerDuty: https://yourcompany.pagerduty.com
2. Navigate to: **Services** → **Your Service** → **Integrations**
3. Click **Add Integration** → Select **Events API v2**
4. Click **Add** → Copy the **Integration Key** (this is your routing key)

### Step 2: Configure Environment (1 minute)

Create `.env` file or set environment variables:

```bash
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=your_routing_key_from_step_1
PAGERDUTY_SEVERITY_THRESHOLD=50
PAGERDUTY_AUTO_RESOLVE=true
```

### Step 3: Test the Integration (2 minutes)

```bash
# Run the test suite
node test-pagerduty.js

# Should see: Tests Passed: 23/24
```

### Step 4: Run the Monitor

```bash
# Single process mode
PROCESS_ID=your-process-id node nonce-monitor.js

# Multi-process mode
CONFIG_FILE=./process-ids.txt node nonce-monitor.js
```

## Configuration Options

### Minimal Configuration (PagerDuty only)
```bash
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=abc123...
```

### Dual-Channel (Slack + PagerDuty)
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=abc123...
PAGERDUTY_SEVERITY_THRESHOLD=50  # PagerDuty for critical (≥50 slots)
```

### Custom Thresholds
```bash
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=abc123...
PAGERDUTY_SEVERITY_THRESHOLD=100  # Only alert for severe issues (≥100 slots)
PAGERDUTY_AUTO_RESOLVE=false      # Manual incident resolution
```

## GitHub Actions Setup

### Step 1: Add Repository Secret

1. Go to: **Your Repo** → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `PAGERDUTY_ROUTING_KEY`
4. Value: Your routing key from PagerDuty
5. Click **Add secret**

### Step 2: Update Workflow

Add to your workflow YAML under `env:`:

```yaml
env:
  PAGERDUTY_ENABLED: true
  PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
  PAGERDUTY_SEVERITY_THRESHOLD: 50
  PAGERDUTY_AUTO_RESOLVE: true
```

## Verification Checklist

After setup, verify:

- [ ] `node test-pagerduty.js` shows 23/24 tests passing
- [ ] Environment variables are set correctly
- [ ] PagerDuty routing key is valid (40-character string)
- [ ] Test incident appears in PagerDuty UI
- [ ] Slack alerts still work (if configured)

## Quick Troubleshooting

### "Missing routing key" error
**Solution:** Set `PAGERDUTY_ROUTING_KEY` environment variable

### No incidents appearing in PagerDuty
**Solution:** Check that `PAGERDUTY_ENABLED=true` is set

### Duplicate incidents
**Solution:** Ensure deduplication is working (same process/day = single incident)

### Auto-resolution not working
**Solution:** Verify `PAGERDUTY_AUTO_RESOLVE=true` (default)

## What Gets Alerted?

### Mismatch Alerts (Trigger PagerDuty)
- Process falls ≥50 slots behind scheduler (configurable threshold)
- Severity based on slots behind:
  - **Critical:** ≥100 slots
  - **Error:** 50-99 slots
  - **Warning:** <50 slots (not sent by default)

### Error Alerts (Trigger PagerDuty)
- Network failures to state/SU router endpoints
- JSON parsing errors
- Invalid process IDs
- API timeouts

### Auto-Resolution (When Enabled)
- Process catches up to scheduler
- Next successful check after mismatch

## Common Usage Patterns

### Pattern 1: Informational Slack + Critical PagerDuty
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=abc123...
PAGERDUTY_SEVERITY_THRESHOLD=50
```
**Result:** Slack gets all mismatches, PagerDuty only gets critical (≥50 slots)

### Pattern 2: PagerDuty Only (No Slack)
```bash
PAGERDUTY_ENABLED=true
PAGERDUTY_ROUTING_KEY=abc123...
# SLACK_WEBHOOK_URL not set
```
**Result:** All alerts go to PagerDuty only

### Pattern 3: Development/Testing (Disabled)
```bash
PAGERDUTY_ENABLED=false
# or just omit PAGERDUTY_ENABLED (defaults to false)
```
**Result:** No PagerDuty alerts sent (useful for development)

## Example Incident Payload

When a process falls behind, PagerDuty receives:

```json
{
  "routing_key": "your-routing-key",
  "event_action": "trigger",
  "dedup_key": "nonce-monitor-mismatch-processId-20251005",
  "payload": {
    "summary": "Process abc123...xyz789 is 75 slots behind scheduler",
    "severity": "error",
    "source": "nonce-monitor",
    "timestamp": "2025-10-05T19:30:00.000Z",
    "custom_details": {
      "processId": "abc123...xyz789",
      "stateNonce": "1000",
      "suRouterNonce": "1075",
      "slotsBehind": 75
    }
  }
}
```

## Next Steps

- **Full Setup Guide:** See `PAGERDUTY_SETUP.md`
- **API Reference:** See PagerDuty Events API v2 docs
- **Module Documentation:** See `lib/pagerduty.js` source code
- **Troubleshooting:** See `PAGERDUTY_SETUP.md` troubleshooting section

## Getting Help

1. Check `PAGERDUTY_SETUP.md` for detailed documentation
2. Review test suite: `node test-pagerduty.js`
3. Enable debug logging: Review console output during `nonce-monitor.js` execution
4. Verify PagerDuty service configuration in PagerDuty UI

---

**Ready to deploy?** Run `node test-pagerduty.js` to validate your setup!
