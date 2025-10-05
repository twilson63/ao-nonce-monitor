# GitHub Actions Setup Guide

## Overview

### What is GitHub Actions Monitoring

GitHub Actions monitoring allows you to run your process monitoring scripts automatically from GitHub's cloud infrastructure. Instead of setting up a cron job on your own server, GitHub Actions runs your checks on their servers at scheduled intervals.

### Benefits vs Traditional Cron

- **No server maintenance**: GitHub manages the infrastructure
- **Built-in logging**: All execution logs are stored and viewable in GitHub
- **Easy configuration**: Change schedules via YAML files
- **Version controlled**: All configuration is in your repository
- **Notifications**: Native integration with GitHub notifications
- **Free for public repos**: No infrastructure costs

### Cost Considerations

- **Public repositories**: Completely free, unlimited minutes
- **Private repositories**: 
  - Free tier: 2,000 minutes/month
  - Checking every 5 minutes ≈ 8,640 runs/month × ~1 min = ~8,640 minutes (exceeds free tier)
  - Checking every 15 minutes ≈ 2,880 runs/month × ~1 min = ~2,880 minutes (within paid plans)
  - Checking hourly ≈ 720 runs/month × ~1 min = ~720 minutes (within free tier)

## Prerequisites

Before setting up GitHub Actions monitoring, ensure you have:

1. A GitHub repository with your monitoring code
2. Process ID(s) you want to monitor
3. (Optional) Slack webhook URL for notifications
4. Basic familiarity with GitHub interface

## Quick Start

### 5-Step Setup

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/repo.git
   git push -u origin main
   ```

2. **Configure secrets**
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add `PROCESS_ID` with your process ID value

3. **Enable the workflow**
   - Workflows in `.github/workflows/` are automatically detected
   - No manual enabling required

4. **Test manually first**
   - Go to Actions tab
   - Select your workflow
   - Click "Run workflow" dropdown
   - Click "Run workflow" button

5. **Verify execution**
   - Check the Actions tab for the workflow run
   - Review logs to ensure it's working correctly

## Setting Up Secrets

Secrets store sensitive data like process IDs and webhook URLs securely.

### Adding Secrets via GitHub UI

1. Navigate to your repository on GitHub
2. Click **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** button
5. Add the following secrets:

#### Required Secrets

**PROCESS_ID**
- Name: `PROCESS_ID`
- Value: Your process ID (e.g., `12345`)
- Used for: Single-process monitoring

#### Optional Secrets

**SLACK_WEBHOOK_URL**
- Name: `SLACK_WEBHOOK_URL`
- Value: Your Slack webhook URL (e.g., `https://hooks.slack.com/services/XXX/YYY/ZZZ`)
- Used for: Sending notifications to Slack

**REQUEST_TIMEOUT**
- Name: `REQUEST_TIMEOUT`
- Value: Timeout in seconds (e.g., `30`)
- Used for: Custom timeout duration
- Default: 10 seconds if not set

**PAGERDUTY_ROUTING_KEY** (Optional)
- Name: `PAGERDUTY_ROUTING_KEY`
- Value: Your PagerDuty Events API v2 routing key (e.g., `R0123456789ABCDEFGHIJKLMNOPQR`)
- Used for: Sending critical alerts to PagerDuty
- Get from: PagerDuty → Services → Your Service → Integrations → Events API v2
- Only required if you want PagerDuty alerts from GitHub Actions workflows
- See [PAGERDUTY_SETUP.md](PAGERDUTY_SETUP.md) for detailed setup

**PAGERDUTY_SEVERITY_THRESHOLD** (Optional)
- Name: `PAGERDUTY_SEVERITY_THRESHOLD`
- Value: Minimum slots behind to trigger PagerDuty alert (e.g., `100`)
- Used for: Controlling PagerDuty alert sensitivity
- Default: 50 slots if not set
- Recommended: Higher than Slack threshold (e.g., 100 for PagerDuty, 50 for Slack)

### Adding Secrets via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Login: gh auth login

# Add process ID
gh secret set PROCESS_ID --body "12345"

# Add Slack webhook (optional)
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/XXX/YYY/ZZZ"

# Add timeout (optional)
gh secret set REQUEST_TIMEOUT --body "30"

# Add PagerDuty routing key (optional)
gh secret set PAGERDUTY_ROUTING_KEY --body "R0123456789ABCDEFGHIJKLMNOPQR"

# Add PagerDuty severity threshold (optional)
gh secret set PAGERDUTY_SEVERITY_THRESHOLD --body "100"

# List all secrets
gh secret list
```

## Workflow Configuration

### Workflow Files Location

Workflow files are stored in `.github/workflows/` directory:

```
.github/
└── workflows/
    ├── monitor-single.yml      # Single process monitoring
    └── monitor-multiple.yml    # Multiple process monitoring
```

### Single-Process Monitoring

File: `.github/workflows/monitor-single.yml`

```yaml
name: Monitor Process

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:        # Allow manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run monitor
        env:
          PROCESS_ID: ${{ secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          REQUEST_TIMEOUT: ${{ secrets.REQUEST_TIMEOUT }}
          PAGERDUTY_ENABLED: true
          PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
          PAGERDUTY_SEVERITY_THRESHOLD: ${{ secrets.PAGERDUTY_SEVERITY_THRESHOLD || 50 }}
          PAGERDUTY_AUTO_RESOLVE: true
        run: node scripts/check-single.js
```

### Multi-Process Monitoring

File: `.github/workflows/monitor-multiple.yml`

```yaml
name: Monitor Multiple Processes

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:        # Allow manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run monitor
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          REQUEST_TIMEOUT: ${{ secrets.REQUEST_TIMEOUT }}
          PAGERDUTY_ENABLED: true
          PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
          PAGERDUTY_SEVERITY_THRESHOLD: ${{ secrets.PAGERDUTY_SEVERITY_THRESHOLD || 50 }}
          PAGERDUTY_AUTO_RESOLVE: true
        run: node scripts/check-multiple.js
```

### Modifying the Schedule

The schedule is controlled by the `cron` syntax:

```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
```

Common schedules:

```yaml
# Every 5 minutes
- cron: '*/5 * * * *'

# Every 15 minutes
- cron: '*/15 * * * *'

# Every hour
- cron: '0 * * * *'

# Every 6 hours
- cron: '0 */6 * * *'

# Every day at midnight UTC
- cron: '0 0 * * *'

# Every Monday at 9 AM UTC
- cron: '0 9 * * 1'
```

**Note**: GitHub Actions schedules use UTC timezone.

### Enabling/Disabling Workflows

**To disable a workflow:**

1. Go to Actions tab
2. Select the workflow from the left sidebar
3. Click the "⋯" menu → "Disable workflow"

Or comment out the schedule in the workflow file:

```yaml
on:
  # schedule:
  #   - cron: '*/5 * * * *'
  workflow_dispatch:  # Keep manual trigger
```

**To enable a workflow:**

1. Go to Actions tab
2. Select the workflow from the left sidebar
3. Click "Enable workflow" button

## Manual Triggering

### Using workflow_dispatch

The `workflow_dispatch` event allows manual workflow execution.

#### Via GitHub UI

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select your workflow from the left sidebar
4. Click **Run workflow** dropdown button (top right)
5. Select the branch (usually `main`)
6. Click **Run workflow** button

#### Via GitHub CLI

```bash
# Trigger single-process workflow
gh workflow run monitor-single.yml

# Trigger multi-process workflow
gh workflow run monitor-multiple.yml

# View recent workflow runs
gh run list

# View logs for most recent run
gh run view --log
```

### Testing Before Scheduling

Best practice: Always test manually before enabling scheduled runs.

1. Add `workflow_dispatch` to your workflow
2. Trigger manually via UI or CLI
3. Review logs to ensure everything works
4. Only then add the `schedule` trigger

## Monitoring Workflows

### Viewing Logs

1. Go to repository **Actions** tab
2. Click on a workflow run to see details
3. Click on the job name to see step-by-step logs
4. Expand each step to see detailed output

### Understanding Workflow Status

- **Green checkmark**: Workflow succeeded
- **Red X**: Workflow failed
- **Yellow dot**: Workflow in progress
- **Gray circle**: Workflow pending or skipped

### Downloading Logs

1. Open a workflow run
2. Click the "⋯" menu (top right)
3. Select "Download log archive"
4. Logs download as a ZIP file

### Viewing Execution History

The Actions tab shows:
- All workflow runs (past and present)
- Duration of each run
- Status of each run
- Triggered by (schedule, manual, etc.)

Filter by:
- Workflow name
- Branch
- Status
- Event (schedule, workflow_dispatch)

## PagerDuty Integration (Optional)

### Overview

PagerDuty integration enables critical incident management for GitHub Actions monitoring. When enabled, PagerDuty alerts provide:
- Escalation policies and on-call notifications
- Deduplication to prevent alert spam
- Auto-resolution when issues clear
- Incident tracking and analytics

**Note**: PagerDuty is completely optional. If not configured, workflows will only use Slack notifications (if configured).

### Setup Steps

#### 1. Create PagerDuty Integration

Follow [PAGERDUTY_SETUP.md](PAGERDUTY_SETUP.md) to:
1. Create or select a PagerDuty service
2. Add Events API v2 integration
3. Copy the routing key (Integration Key)

#### 2. Add GitHub Secrets

Add to repository secrets (Settings → Secrets → Actions):

**Required for PagerDuty**:
- `PAGERDUTY_ROUTING_KEY`: Your Events API v2 routing key

**Optional**:
- `PAGERDUTY_SEVERITY_THRESHOLD`: Slots behind threshold (default: 50)

Via GitHub CLI:
```bash
gh secret set PAGERDUTY_ROUTING_KEY --body "R0123456789ABCDEFGHIJKLMNOPQR"
gh secret set PAGERDUTY_SEVERITY_THRESHOLD --body "100"
```

#### 3. Enable in Workflow

PagerDuty is enabled by setting `PAGERDUTY_ENABLED: true` in your workflow's `env` section. The example workflows above already include this configuration.

To disable PagerDuty without removing secrets:
```yaml
env:
  PAGERDUTY_ENABLED: false  # Change to false
  PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
```

Or simply remove the PagerDuty environment variables entirely.

#### 4. Test the Integration

Trigger a manual workflow run and verify:
1. Check workflow logs for PagerDuty event messages
2. Check PagerDuty service for new incidents
3. Verify deduplication works on subsequent runs

### Configuration Options

**PAGERDUTY_ENABLED**:
- Set to `true` to enable PagerDuty alerts
- Set to `false` or remove to disable
- Default: false (if not specified)

**PAGERDUTY_SEVERITY_THRESHOLD**:
- Minimum slots behind to trigger PagerDuty alert
- Default: 50 slots
- Recommended: Use higher threshold for PagerDuty (100) than Slack (50)
- Example: Only page on-call for severe issues (≥100 slots), but notify Slack for all issues (≥50 slots)

**PAGERDUTY_AUTO_RESOLVE**:
- Set to `true` to auto-resolve incidents when processes catch up
- Set to `false` to require manual resolution
- Default: true

### Best Practices

**Separate Thresholds for Slack vs PagerDuty**:
```yaml
env:
  # Slack - All issues (informational)
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  
  # PagerDuty - Critical issues only (pages on-call)
  PAGERDUTY_ENABLED: true
  PAGERDUTY_ROUTING_KEY: ${{ secrets.PAGERDUTY_ROUTING_KEY }}
  PAGERDUTY_SEVERITY_THRESHOLD: 100  # Higher threshold
```

**Enable Auto-Resolution**:
- Reduces manual toil for on-call engineers
- Incidents auto-resolve on next successful check
- Recommended for transient issues

**Test Before Deploying**:
1. Create a test PagerDuty service
2. Use test routing key in staging
3. Trigger intentional alerts
4. Verify deduplication and auto-resolution
5. Deploy to production with production routing key

## Multi-Process Setup

### Step 1: Create process-ids.txt

Create a file with one process ID per line:

```
12345
67890
24680
13579
```

### Step 2: Commit the File

```bash
git add process-ids.txt
git commit -m "Add process IDs for monitoring"
git push
```

**Important**: Ensure `process-ids.txt` is NOT in `.gitignore`

### Step 3: Use Multi-Process Workflow

The workflow at `.github/workflows/monitor-multiple.yml` will automatically read from `process-ids.txt`.

### Step 4: Test Execution

```bash
# Test locally first
node scripts/check-multiple.js

# Then test via GitHub Actions
gh workflow run monitor-multiple.yml
```

### Switching Between Workflows

You can have both workflows enabled:
- `monitor-single.yml` - Uses `PROCESS_ID` secret
- `monitor-multiple.yml` - Uses `process-ids.txt` file

Disable the one you're not using via the Actions tab.

## Troubleshooting

### Workflow Not Triggering

**Problem**: Scheduled workflow doesn't run

**Possible Causes:**
1. Workflow is disabled
2. Repository is inactive (GitHub disables workflows after 60 days of no commits)
3. Schedule syntax error

**Solutions:**
```bash
# Check if workflow is enabled
gh workflow list

# Enable workflow
gh workflow enable monitor-single.yml

# Make a commit to reactivate repository
git commit --allow-empty -m "Keep repository active"
git push

# Verify cron syntax at crontab.guru
```

### Secrets Not Accessible

**Problem**: Workflow logs show empty secret values or errors

**Possible Causes:**
1. Secret not created
2. Secret name mismatch
3. Typo in workflow file

**Solutions:**
1. Verify secrets exist:
   ```bash
   gh secret list
   ```

2. Check secret names match exactly in workflow:
   ```yaml
   env:
     PROCESS_ID: ${{ secrets.PROCESS_ID }}  # Must match secret name
   ```

3. Re-create secret if needed:
   ```bash
   gh secret set PROCESS_ID --body "12345"
   ```

### Timeout Errors

**Problem**: Workflow fails with timeout errors

**Solutions:**
1. Increase timeout in secrets:
   ```bash
   gh secret set REQUEST_TIMEOUT --body "60"
   ```

2. Add timeout to workflow job:
   ```yaml
   jobs:
     monitor:
       runs-on: ubuntu-latest
       timeout-minutes: 5  # Add this line
   ```

3. Check if the monitoring endpoint is slow or down

### Schedule Delays

**Problem**: Workflow doesn't run exactly at scheduled time

**Explanation**: GitHub Actions scheduled workflows can be delayed by up to 10-15 minutes during high load times. This is normal behavior.

**Solutions:**
- Accept the delay (it's free infrastructure)
- Use a more frequent schedule if timing is critical
- Consider self-hosted runners for precise timing
- Use cron on your own server for mission-critical timing

## Cost Management

### Free Tier Limits

**Public Repositories:**
- Unlimited minutes
- Unlimited storage
- No cost

**Private Repositories:**
- Free tier: 2,000 minutes/month
- Storage: 500 MB
- Minutes reset monthly

### Usage Monitoring

View your usage:

1. Click your profile (top right) → Settings
2. Click **Billing and plans** (left sidebar)
3. View **Actions** usage

Or via CLI:
```bash
# View billing info (requires admin permissions)
gh api /user/settings/billing/actions
```

### Optimization Tips

**1. Increase check intervals:**
```yaml
# Instead of every 5 minutes (8,640 min/month)
- cron: '*/5 * * * *'

# Use every hour (720 min/month)
- cron: '0 * * * *'

# Or every 15 minutes (2,880 min/month)
- cron: '*/15 * * * *'
```

**2. Limit workflow runs:**
```yaml
# Only run during business hours (reduces usage by ~66%)
- cron: '0 9-17 * * 1-5'  # 9 AM - 5 PM, Monday-Friday
```

**3. Use conditional execution:**
```yaml
jobs:
  monitor:
    if: github.event_name == 'workflow_dispatch' || (github.event_name == 'schedule' && github.ref == 'refs/heads/main')
```

### When to Use Cron Instead

Use traditional cron when:
- You already have a server running 24/7
- You need sub-5-minute intervals
- You exceed GitHub Actions limits
- You need precise timing guarantees
- Your private repo usage exceeds budget

## Best Practices

### 1. Never Commit Secrets

**Bad:**
```javascript
const PROCESS_ID = '12345';  // DON'T DO THIS
const WEBHOOK = 'https://hooks.slack.com/...';  // DON'T DO THIS
```

**Good:**
```javascript
const PROCESS_ID = process.env.PROCESS_ID;
const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
```

Always use environment variables and GitHub secrets.

### 2. Use workflow_dispatch for Testing

Always include `workflow_dispatch` in your workflows:

```yaml
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:  # Always include this
```

This allows manual testing before scheduling.

### 3. Monitor Execution Times

Keep an eye on how long workflows take:
- Check the Actions tab regularly
- Look for increasing execution times
- Optimize slow steps

### 4. Set Appropriate Timeouts

Prevent runaway workflows:

```yaml
jobs:
  monitor:
    runs-on: ubuntu-latest
    timeout-minutes: 5  # Workflow timeout
    steps:
      - name: Run monitor
        timeout-minutes: 2  # Step timeout
        run: node scripts/check-single.js
```

### 5. Enable Notifications

Get notified of failures:

1. Go to Settings → Notifications
2. Under "Actions", enable:
   - "Failed workflows"
   - "Cancelled workflows"

Or set up email notifications in workflow:

```yaml
- name: Notify on failure
  if: failure()
  run: echo "Workflow failed! Check logs."
```

### 6. Keep Dependencies Updated

Regularly update GitHub Actions:

```yaml
- uses: actions/checkout@v4  # Not v2 or v3
- uses: actions/setup-node@v4  # Latest version
```

### 7. Use Concurrency Control

Prevent multiple instances running simultaneously:

```yaml
concurrency:
  group: monitor-process
  cancel-in-progress: true
```

### 8. Add Status Badges

Show workflow status in README:

```markdown
![Monitor Status](https://github.com/username/repo/actions/workflows/monitor-single.yml/badge.svg)
```

## Comparison Table

| Feature | GitHub Actions | Cron on Server |
|---------|---------------|----------------|
| **Setup Complexity** | Low (YAML config) | Medium (SSH, crontab) |
| **Cost** | Free (public) / Limited (private) | Server cost |
| **Maintenance** | None (managed by GitHub) | Server maintenance required |
| **Logging** | Built-in, web UI | Manual setup (syslog, files) |
| **Notifications** | Built-in GitHub notifications | Manual setup |
| **Version Control** | Yes (YAML in repo) | No (crontab not versioned) |
| **Minimum Interval** | 5 minutes (practical limit) | 1 minute (or less) |
| **Reliability** | 99.9% uptime | Depends on server |
| **Timing Precision** | ±10-15 min delay possible | Exact (within seconds) |
| **Scalability** | Unlimited (public) / Limited by budget (private) | Limited by server resources |
| **Access Control** | GitHub permissions | SSH/server access |
| **Testing** | Manual trigger via UI | Manual cron execution |
| **Secrets Management** | GitHub Secrets (encrypted) | Environment variables / files |
| **Debugging** | Web UI with logs | SSH + log files |

### Recommendation Matrix

**Use GitHub Actions when:**
- You have a public repository
- You want zero infrastructure costs
- You need built-in logging and notifications
- Check interval of 5+ minutes is acceptable
- You want easy configuration and version control

**Use Cron when:**
- You need checks more frequent than every 5 minutes
- You need precise timing guarantees
- You already have a server running
- Your private repo usage exceeds GitHub limits
- You need complete control over the environment

**Use Both when:**
- GitHub Actions for backup/redundancy
- Cron for primary monitoring
- Provides failover capability

---

## Quick Reference

### Essential Commands

```bash
# GitHub CLI Setup
gh auth login

# Secrets Management
gh secret set PROCESS_ID --body "12345"
gh secret list

# Workflow Management
gh workflow list
gh workflow enable monitor-single.yml
gh workflow disable monitor-single.yml
gh workflow run monitor-single.yml

# Monitoring
gh run list
gh run view --log
gh run watch

# Check usage
gh api /user/settings/billing/actions
```

### Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Cron Syntax Helper](https://crontab.guru)
- [GitHub Actions Pricing](https://github.com/pricing)
- [GitHub Status](https://www.githubstatus.com)

---

**Need Help?**

- Check workflow logs in the Actions tab
- Review this troubleshooting section
- Search [GitHub Community](https://github.community)
- Check [GitHub Actions documentation](https://docs.github.com/en/actions)
