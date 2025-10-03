# Production Deployment Guide

This guide provides comprehensive instructions for deploying the AO Network Nonce Monitor in production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Deployment Option 1: GitHub Actions (Recommended)](#deployment-option-1-github-actions-recommended)
3. [Deployment Option 2: Cron on Server](#deployment-option-2-cron-on-server)
4. [Installation Steps](#installation-steps)
5. [Slack Webhook Setup](#slack-webhook-setup)
6. [Multi-Process Configuration](#multi-process-configuration)
7. [Crontab Configuration](#crontab-configuration)
8. [Log Management](#log-management)
9. [Performance Tuning](#performance-tuning)
10. [Process Management](#process-management)
11. [Security Considerations](#security-considerations)
12. [Monitoring and Alerting](#monitoring-and-alerting)
13. [Slack Integration Best Practices](#slack-integration-best-practices)
14. [Scaling Considerations](#scaling-considerations)
15. [Backup and Recovery](#backup-and-recovery)
16. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **OS**: Linux/Unix-based system (Ubuntu 20.04+, Debian 11+, RHEL 8+, macOS)
- **Node.js**: Version 18.0.0 or higher
- **User Privileges**: Standard user account with cron access
- **Disk Space**: Minimum 100MB for logs (depending on monitoring frequency)
- **Network**: Outbound HTTPS access to:
  - `state.forward.computer`
  - `su-router.ao-testnet.xyz`
  - `hooks.slack.com` (optional, if using Slack notifications)

### Optional Requirements
- **Slack Workspace Access**: For production alerting (recommended)
- **Slack Admin Permissions**: To create incoming webhooks

### Pre-Installation Checklist
```bash
# Verify Node.js version
node --version  # Should be >= 18.0.0

# Verify npm is installed
npm --version

# Verify cron service is running
systemctl status cron  # Ubuntu/Debian
systemctl status crond # RHEL/CentOS

# Verify network connectivity
curl -I https://state.forward.computer
curl -I https://su-router.ao-testnet.xyz
```

### Configuration File Setup
Before deployment, you need to prepare your process configuration:
- Create `process-ids.txt` from the provided template
- Configure at least one process ID for initial testing
- Plan your multi-process deployment strategy (recommended: start with 1-5 processes)

---

## Deployment Option 1: GitHub Actions (Recommended)

### Overview
GitHub Actions provides serverless execution with zero infrastructure management.

**Best for:**
- Teams without dedicated infrastructure
- Public repositories (unlimited free minutes)
- Quick setup and easy maintenance
- Version-controlled deployment

### Prerequisites
- GitHub repository with code pushed
- GitHub account with Actions enabled
- Process ID(s) to monitor
- (Optional) Slack webhook URL

### Step-by-Step Setup

#### 1. Push Code to GitHub
```bash
git push origin main
```

#### 2. Configure GitHub Secrets
Navigate to: `Settings → Secrets and variables → Actions → New repository secret`

Add the following secrets:

**Required:**
- `PROCESS_ID`: Your AO process ID
  - Example: `0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc`

**Optional:**
- `SLACK_WEBHOOK_URL`: Your Slack webhook URL
  - Get from: https://api.slack.com/apps
- `REQUEST_TIMEOUT`: Request timeout in milliseconds
  - Default: `10000`

**Using GitHub CLI:**
```bash
# Install GitHub CLI if not already installed
# brew install gh  # macOS
# apt install gh   # Ubuntu

# Authenticate
gh auth login

# Set secrets
gh secret set PROCESS_ID
# Paste your process ID when prompted

gh secret set SLACK_WEBHOOK_URL
# Paste your webhook URL when prompted
```

**Using Helper Script:**
```bash
./setup-github-secrets.sh
```

#### 3. Choose Workflow

**Single Process Monitoring:**
- File: `.github/workflows/nonce-monitor.yml`
- Uses `PROCESS_ID` secret
- Runs every 5 minutes automatically

**Multi-Process Monitoring:**
- File: `.github/workflows/nonce-monitor-multi.yml`
- Uses `process-ids.txt` from repository
- Ensure `process-ids.txt` is committed to repo

#### 4. Enable Workflow

Workflows are enabled by default once pushed to GitHub. To verify:

1. Go to repository on GitHub
2. Click "Actions" tab
3. You should see "AO Network Nonce Monitor" workflow
4. It will run automatically every 5 minutes

#### 5. Manual Test Run

Before waiting for scheduled run:

1. Go to "Actions" tab
2. Select workflow (left sidebar)
3. Click "Run workflow" button
4. Select branch (main)
5. Click "Run workflow"
6. Wait ~30 seconds for completion
7. Click on the run to view logs

#### 6. Monitor Execution

**View Logs:**
- Actions tab → Click any workflow run
- Expand steps to see detailed output
- Download logs if needed

**Execution History:**
- See all runs in Actions tab
- Filter by status (success/failure)
- View timing and duration

**Notifications:**
- GitHub sends email on workflow failures
- Configure in: Settings → Notifications

### Modifying Schedule

To change from 5 minutes to different interval:

1. Edit `.github/workflows/nonce-monitor.yml`
2. Change cron schedule:
   ```yaml
   schedule:
     - cron: '*/15 * * * *'  # Every 15 minutes
   ```
3. Commit and push changes

### Disabling Monitoring

**Temporary:**
- Actions tab → Select workflow → "..." → "Disable workflow"

**Permanent:**
- Delete `.github/workflows/nonce-monitor.yml`

### Troubleshooting

See [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) for detailed troubleshooting.

**Common Issues:**
- Workflow not triggering: Check repository is active, wait 5-10 minutes
- Secrets not working: Verify secret names match exactly
- Timeout errors: Increase timeout in workflow file

### Cost Management

**Free Tier Limits:**
- Public repos: Unlimited minutes
- Private repos: 2,000 minutes/month

**Current Usage:**
- ~30 seconds per run
- 12 runs/hour = 288 runs/day
- ~144 minutes/day = ~4,320 minutes/month

**For Private Repos:**
- Exceeds free tier at 5-minute interval
- Options:
  1. Make repository public (unlimited)
  2. Increase interval to 15 minutes (~1,440 min/month)
  3. Upgrade to paid plan ($8/month for extra minutes)

---

## Deployment Option 2: Cron on Server

### Overview
Traditional server-based deployment using cron for scheduled execution.

**Best for:**
- Teams with existing server infrastructure
- Need for custom server configuration
- Private deployment requirements
- High-frequency monitoring needs

## Installation Steps

### 1. Create Application Directory
```bash
# Create dedicated directory
sudo mkdir -p /opt/nonce-monitor
sudo chown $USER:$USER /opt/nonce-monitor

# Or use user home directory (alternative)
mkdir -p ~/nonce-monitor
cd ~/nonce-monitor
```

### 2. Clone or Copy Application Files
```bash
cd /opt/nonce-monitor

# If using git
git clone <repository-url> .

# Or manually copy files
# - nonce-monitor.js
# - package.json
# - .env.example
# - process-ids.txt.template
```

### 3. Install Dependencies
```bash
cd /opt/nonce-monitor
npm install --production
```

### 4. Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Configuration Parameters:**
```bash
# Optional: Request timeout in milliseconds (default: 10000)
REQUEST_TIMEOUT=30000

# Optional: Concurrent request limit (default: 5)
CONCURRENT_LIMIT=10
```

### 5. Create Process Configuration File
```bash
# Copy template
cp process-ids.txt.template process-ids.txt

# Edit to add your process IDs
nano process-ids.txt
```

**Add your process IDs (one per line):**
```
# Production processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc

# Staging processes
# abc123def456ghi789jkl012mno345pqr678stu901vwx

# Comments are ignored (lines starting with #)
```

### 6. Validate Configuration (Single Process Test)
```bash
# Test with a single process first
echo "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc" > process-ids.txt
npm start

# Expected output:
# [2025-10-03T12:00:00.000Z] State Nonce: 12345 | SU Router Nonce: 12345 | Status: MATCH ✓
# === Summary: 1 processes | 1 success | 0 failed | 0 errors ===
```

### 7. Create Log Directory
```bash
# Create logs directory
sudo mkdir -p /var/log/nonce-monitor
sudo chown $USER:$USER /var/log/nonce-monitor

# Or use application directory
mkdir -p /opt/nonce-monitor/logs
```

### 8. Set Executable Permissions
```bash
chmod +x /opt/nonce-monitor/nonce-monitor.js
```

### 9. Configure Slack Webhook (Optional but Recommended for Production)
```bash
# Add Slack webhook URL to .env file
echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL" >> .env

# Protect .env file
chmod 600 .env
```

See [Slack Webhook Setup](#slack-webhook-setup) section for detailed instructions.

---

## Slack Webhook Setup

Slack notifications are **highly recommended for production deployments** to receive real-time alerts when nonce mismatches occur.

### When to Enable Slack Notifications

**Recommended scenarios:**
- Production deployments monitoring critical processes
- Systems requiring immediate alert response
- Deployments with multiple team members who need to be notified
- High-value processes where downtime is costly

**Not necessary for:**
- Local development and testing
- Single-user deployments with manual monitoring
- Environments with other alerting systems already in place

### Step-by-Step Webhook Creation

#### 1. Create Slack Incoming Webhook

**Via Slack App Directory:**
```
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "AO Nonce Monitor" (or your preferred name)
4. Select your workspace
5. Click "Incoming Webhooks" in the sidebar
6. Toggle "Activate Incoming Webhooks" to ON
7. Click "Add New Webhook to Workspace"
8. Select the channel for notifications (e.g., #ao-monitoring, #alerts)
9. Click "Allow"
10. Copy the webhook URL (starts with https://hooks.slack.com/services/...)
```

**Example webhook URL format:**
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

#### 2. Test Webhook Before Deployment

**Test with curl:**
```bash
# Replace with your actual webhook URL
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Send test message
curl -X POST "$WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d '{"text":"✅ AO Nonce Monitor webhook test - working correctly!"}'
```

**Expected result:**
- Message appears in your selected Slack channel
- curl returns `ok` response

**If test fails:**
- Verify webhook URL is copied correctly
- Check network connectivity: `curl -I https://hooks.slack.com`
- Ensure webhook hasn't been revoked in Slack settings

#### 3. Configure Webhook URL in Application

**Add to .env file:**
```bash
cd /opt/nonce-monitor

# Edit .env file
nano .env

# Add this line (replace with your actual webhook URL)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Alternative: Set in crontab environment:**
```bash
crontab -e

# Add at the top of crontab
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Your regular cron job
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### 4. Verify Integration

**Run manual test:**
```bash
cd /opt/nonce-monitor
npm start
```

**If webhook is configured correctly:**
- Application runs normally
- If mismatches occur, Slack notifications are sent
- Check Slack channel for test notifications

### Security Considerations

**⚠️ IMPORTANT: Treat webhook URLs as secrets**

The webhook URL should be protected like a password:

**DO:**
- ✅ Store in environment variables or `.env` file
- ✅ Set file permissions to 600: `chmod 600 .env`
- ✅ Add `.env` to `.gitignore`
- ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Document webhook location in password manager
- ✅ Rotate webhook if accidentally exposed

**DON'T:**
- ❌ Commit webhook URL to version control
- ❌ Share webhook URL in public channels
- ❌ Include in documentation or wiki pages
- ❌ Send via unencrypted email
- ❌ Hardcode in application code

**Rotating a compromised webhook:**
```bash
# If webhook URL is exposed:
# 1. Go to https://api.slack.com/apps
# 2. Select your app
# 3. Click "Incoming Webhooks"
# 4. Delete the compromised webhook
# 5. Create a new webhook
# 6. Update .env with new URL
```

### Webhook Storage Best Practices

#### Option 1: Environment File (Recommended for single server)
```bash
# /opt/nonce-monitor/.env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
REQUEST_TIMEOUT=30000
CONCURRENT_LIMIT=10
```

**Permissions:**
```bash
chmod 600 /opt/nonce-monitor/.env
chown $USER:$USER /opt/nonce-monitor/.env
```

#### Option 2: Crontab Environment (Simple deployments)
```bash
crontab -e

# Add at top
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### Option 3: AWS Secrets Manager (Enterprise)
```bash
#!/bin/bash
# Fetch webhook from AWS Secrets Manager
SLACK_WEBHOOK_URL=$(aws secretsmanager get-secret-value \
    --secret-id nonce-monitor/slack-webhook \
    --query SecretString \
    --output text)

export SLACK_WEBHOOK_URL
cd /opt/nonce-monitor && node nonce-monitor.js
```

#### Option 4: HashiCorp Vault (Enterprise)
```bash
#!/bin/bash
# Fetch webhook from Vault
SLACK_WEBHOOK_URL=$(vault kv get -field=webhook secret/nonce-monitor/slack)

export SLACK_WEBHOOK_URL
cd /opt/nonce-monitor && node nonce-monitor.js
```

### Example Crontab with Slack Integration

**Basic setup:**
```bash
# Environment variables
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

# Run every 5 minutes
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

**With .env file:**
```bash
# Load environment from .env file
*/5 * * * * cd /opt/nonce-monitor && export $(grep -v '^#' .env | xargs) && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

**Multiple environments:**
```bash
# Production webhook
SLACK_WEBHOOK_URL_PROD=https://hooks.slack.com/services/PROD/WEBHOOK/URL

# Staging webhook
SLACK_WEBHOOK_URL_STAGING=https://hooks.slack.com/services/STAGING/WEBHOOK/URL

# Production monitoring (critical channel)
*/5 * * * * cd /opt/nonce-monitor/prod && SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL_PROD /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/prod.log 2>&1

# Staging monitoring (non-critical channel)
*/15 * * * * cd /opt/nonce-monitor/staging && SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL_STAGING /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/staging.log 2>&1
```

### Monitoring Slack Alert Delivery

#### How to Verify Alerts Are Working

**Method 1: Intentional mismatch test (development only)**
```bash
# Create test environment
mkdir -p /tmp/nonce-monitor-test
cd /tmp/nonce-monitor-test

# Copy application files
cp /opt/nonce-monitor/nonce-monitor.js .
cp /opt/nonce-monitor/package.json .
npm install

# Create test config with known mismatch
# (requires modifying test to force mismatch)

# Run test
SLACK_WEBHOOK_URL="your-test-webhook" npm start
```

**Method 2: Monitor application logs**
```bash
# Check for Slack delivery attempts
grep -i "slack" /var/log/nonce-monitor/monitor.log

# Check for network errors
grep -i "webhook" /var/log/nonce-monitor/monitor.log | grep -i "error"
```

**Method 3: Monitor Slack channel activity**
- Check timestamp of last received alert
- Compare with monitoring schedule
- Ensure alerts correlate with mismatch events in logs

#### Detecting Slack Delivery Failures

**Create monitoring script:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/check-slack-delivery.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"
ALERT_EMAIL="admin@example.com"

# Check for Slack errors in last hour
slack_errors=$(grep "$(date +%Y-%m-%d)" "$LOG_FILE" | grep -i "slack.*error" | tail -12 | wc -l)

if [ "$slack_errors" -gt 2 ]; then
    echo "WARNING: Slack delivery failures detected ($slack_errors errors)"
    echo "Check webhook configuration and network connectivity"
    
    # Send email alert (meta-monitoring)
    echo "Slack webhook delivery failing. Check logs: $LOG_FILE" | \
        mail -s "Nonce Monitor: Slack Integration Failure" "$ALERT_EMAIL"
fi
```

**Add to crontab:**
```bash
# Check Slack delivery every hour
0 * * * * /opt/nonce-monitor/scripts/check-slack-delivery.sh
```

#### Set Up Meta-Monitoring (Alerting on Alert Failures)

**Option 1: Email fallback**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/dual-alert.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"
BACKUP_EMAIL="admin@example.com"

# Run monitor
cd /opt/nonce-monitor && node nonce-monitor.js >> "$LOG_FILE" 2>&1

# Check if Slack delivery failed
if grep -q "Slack.*error" "$LOG_FILE" | tail -20; then
    # Slack failed, use email backup
    latest_summary=$(grep "=== Summary" "$LOG_FILE" | tail -1)
    echo "Slack delivery failed. Latest status: $latest_summary" | \
        mail -s "Nonce Monitor Alert (Slack Failed)" "$BACKUP_EMAIL"
fi
```

**Option 2: Dual webhook setup**
```bash
# Use two different Slack webhooks (different channels)
SLACK_WEBHOOK_PRIMARY="https://hooks.slack.com/services/PRIMARY/WEBHOOK/URL"
SLACK_WEBHOOK_BACKUP="https://hooks.slack.com/services/BACKUP/WEBHOOK/URL"

# Monitor sends to primary, backup channel monitors for silence
```

---

## Multi-Process Configuration

### Creating process-ids.txt

The `process-ids.txt` file contains the list of process IDs to monitor. Each line should contain one process ID.

**File format:**
```
# Comments start with #
# Empty lines are ignored

# Production processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc
abc123def456ghi789jkl012mno345pqr678stu901vwx

# Staging processes  
def456ghi789jkl012mno345pqr678stu901vwx234yz

# Test processes
ghi789jkl012mno345pqr678stu901vwx234yz567abc
```

### Adding/Removing Process IDs

**To add a new process:**
```bash
# Edit the file
nano /opt/nonce-monitor/process-ids.txt

# Add the process ID on a new line
echo "new-process-id-here" >> /opt/nonce-monitor/process-ids.txt

# Test the change
npm start
```

**To remove a process:**
```bash
# Edit the file and delete or comment out the line
nano /opt/nonce-monitor/process-ids.txt

# Or use sed to remove a specific process
sed -i '/specific-process-id/d' /opt/nonce-monitor/process-ids.txt
```

### Comment Syntax for Documentation

Use comments to organize and document your process list:

```
# === PRODUCTION PROCESSES ===
# Customer A - Main Process
customer-a-process-id

# Customer B - Primary and Backup
customer-b-primary-id
customer-b-backup-id

# === STAGING PROCESSES ===
# Testing environment
staging-process-id-1
staging-process-id-2

# === NOTES ===
# Added 2025-10-03: New customer processes
# Removed 2025-10-01: Deprecated test processes
```

### Best Practices

1. **Start Small, Scale Up**
   - Begin with 1-5 processes for initial deployment
   - Monitor performance and logs for 24-48 hours
   - Gradually add more processes in batches of 5-10

2. **Organize Your Process List**
   - Group related processes together
   - Use comments to document ownership and purpose
   - Date-stamp additions and removals

3. **Validation Before Scaling**
   - Always test with `npm start` after editing
   - Verify all process IDs are valid (43-44 characters)
   - Check for duplicate entries

4. **Backup Your Configuration**
   ```bash
   # Backup before major changes
   cp process-ids.txt process-ids.txt.backup.$(date +%Y%m%d)
   ```

### Recommended Process Limits

- **Small deployment (1-10 processes)**: Easy to manage, fast execution
- **Medium deployment (10-50 processes)**: Recommended for most use cases
- **Large deployment (50-100 processes)**: Maximum recommended for single instance
- **100+ processes**: Consider splitting into multiple monitor instances (see [Scaling Considerations](#scaling-considerations))

**Performance expectations:**
- 1 process: ~2 seconds execution time
- 10 processes: ~15 seconds execution time
- 50 processes: ~60 seconds execution time
- 100 processes: ~120 seconds execution time

---

## Crontab Configuration

### Understanding Cron Syntax
```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### How to Edit Crontab
```bash
# Edit crontab for current user
crontab -e

# View current crontab
crontab -l

# Remove all cron jobs
crontab -r

# Edit crontab for specific user (requires sudo)
sudo crontab -u username -e
```

### Example Crontab Entries

#### For Single Process or Small Deployments (1-10 processes)

**Every 5 Minutes (Recommended)**
```bash
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

**Every 1 Minute (High Frequency)**
```bash
* * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### For Medium Deployments (10-30 processes)

**Every 10 Minutes**
```bash
*/10 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### For Large Deployments (30-100 processes)

**Every 15 Minutes**
```bash
*/15 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

**Every 30 Minutes**
```bash
*/30 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

### Scheduling Based on Process Count

**Choose your interval based on:**
- **Execution time**: Allow 2-3x the execution time between runs
- **Log volume**: More frequent = more logs (see [Log Management](#log-management))
- **Monitoring needs**: Critical processes may need frequent checks

**Examples:**
- **10 processes (~15s execution)**: Every 5 minutes is safe
- **50 processes (~60s execution)**: Every 10-15 minutes recommended
- **100 processes (~120s execution)**: Every 15-30 minutes recommended

### Log Volume Considerations

**Estimated log volume by process count and frequency:**

| Processes | Frequency | Lines/Day | Daily Size (approx) |
|-----------|-----------|-----------|---------------------|
| 1         | 5 min     | 288       | 50 KB              |
| 10        | 5 min     | 2,880     | 500 KB             |
| 50        | 15 min    | 4,800     | 800 KB             |
| 100       | 30 min    | 4,800     | 800 KB             |

**Adjust cron frequency to manage log volume:**
- High frequency + many processes = rapid log growth
- Consider log rotation settings (see [Log Management](#log-management))

### Advanced Crontab Configuration

#### Separate Stdout and Stderr Logs
```bash
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>> /var/log/nonce-monitor/error.log
```

#### With Environment Variables
```bash
# Add environment variables at the top of crontab
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production

*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### With .env File Loading
```bash
*/5 * * * * cd /opt/nonce-monitor && export $(cat .env | xargs) && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### Email on Errors Only
```bash
MAILTO=admin@example.com

*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1 || true
```

### Error Handling in Cron

#### Retry on Failure
```bash
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1 || /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### Lock File to Prevent Overlapping Executions
```bash
*/5 * * * * flock -n /tmp/nonce-monitor.lock -c "cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1"
```

#### Timeout Protection (Important for Large Deployments)
```bash
# 5 minute timeout for large deployments
*/5 * * * * timeout 300 bash -c "cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1"
```

---

## Log Management

### Log File Locations

**Recommended Structure:**
```
/var/log/nonce-monitor/
├── monitor.log          # Main application logs
├── error.log           # Error logs only (optional)
└── archive/            # Archived logs
    ├── monitor.log.1.gz
    ├── monitor.log.2.gz
    └── ...
```

### Multi-Process Log Volume Expectations

**Increased log volume with multiple processes:**

- **Single process**: ~200 bytes per run
- **10 processes**: ~2 KB per run (10x process logs + 1 summary)
- **50 processes**: ~10 KB per run (50x process logs + 1 summary)
- **100 processes**: ~20 KB per run (100x process logs + 1 summary)

**Daily volume examples:**
- 10 processes @ 5min: ~576 KB/day (~17 MB/month)
- 50 processes @ 15min: ~960 KB/day (~28 MB/month)
- 100 processes @ 30min: ~960 KB/day (~28 MB/month)

### Log Rotation Setup

#### Using logrotate (Recommended)

**Create logrotate configuration:**
```bash
sudo nano /etc/logrotate.d/nonce-monitor
```

**Configuration for Small Deployments (1-10 processes):**
```
/var/log/nonce-monitor/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 your-username your-username
    dateext
    dateformat -%Y%m%d
    postrotate
        # Optional: Signal application to reopen log files
    endscript
}
```

**Configuration for Medium to Large Deployments (10+ processes):**
```
/var/log/nonce-monitor/monitor.log {
    daily
    rotate 30
    size 50M
    compress
    delaycompress
    missingok
    notifempty
    create 0644 your-username your-username
    dateext
    dateformat -%Y%m%d
    maxage 90
    sharedscripts
}

/var/log/nonce-monitor/error.log {
    daily
    rotate 90
    size 20M
    compress
    delaycompress
    missingok
    notifempty
    create 0644 your-username your-username
    dateext
    dateformat -%Y%m%d
    maxage 365
}
```

**Configuration for Very Large Deployments (50+ processes):**
```
/var/log/nonce-monitor/monitor.log {
    daily
    rotate 14
    size 100M
    compress
    delaycompress
    missingok
    notifempty
    create 0644 your-username your-username
    dateext
    dateformat -%Y%m%d
    maxage 30
    sharedscripts
    postrotate
        # Optional cleanup
        find /var/log/nonce-monitor/archive -name "*.gz" -mtime +30 -delete
    endscript
}
```

**Recommended rotation by process count:**
- **1-10 processes**: Daily rotation, 30-day retention, no size limit
- **10-50 processes**: Daily rotation, size limit 50MB, 30-day retention
- **50+ processes**: Daily rotation, size limit 100MB, 14-day retention

**Test logrotate configuration:**
```bash
# Dry run
sudo logrotate -d /etc/logrotate.d/nonce-monitor

# Force rotation (for testing)
sudo logrotate -f /etc/logrotate.d/nonce-monitor

# Check logrotate status
cat /var/lib/logrotate/status
```

#### Manual Log Rotation Script

**Create rotation script:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/rotate-logs.sh

LOG_DIR="/var/log/nonce-monitor"
ARCHIVE_DIR="$LOG_DIR/archive"
RETENTION_DAYS=30

mkdir -p "$ARCHIVE_DIR"

# Rotate main log
if [ -f "$LOG_DIR/monitor.log" ]; then
    timestamp=$(date +%Y%m%d-%H%M%S)
    gzip -c "$LOG_DIR/monitor.log" > "$ARCHIVE_DIR/monitor-$timestamp.log.gz"
    > "$LOG_DIR/monitor.log"
fi

# Clean old archives
find "$ARCHIVE_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Log rotation completed: $(date)"
```

**Make executable:**
```bash
chmod +x /opt/nonce-monitor/scripts/rotate-logs.sh
```

**Add to crontab (daily at 2 AM):**
```bash
0 2 * * * /opt/nonce-monitor/scripts/rotate-logs.sh >> /var/log/nonce-monitor/rotation.log 2>&1
```

### Log Monitoring Best Practices

#### Real-time Log Monitoring
```bash
# Tail main log
tail -f /var/log/nonce-monitor/monitor.log

# Tail with grep for errors
tail -f /var/log/nonce-monitor/monitor.log | grep ERROR

# Tail with grep for mismatches
tail -f /var/log/nonce-monitor/monitor.log | grep "MISMATCH"

# Show only summary lines
tail -f /var/log/nonce-monitor/monitor.log | grep "=== Summary"

# Follow log with timestamps
tail -f /var/log/nonce-monitor/monitor.log | while read line; do echo "$(date): $line"; done
```

#### Log Analysis Commands
```bash
# Count total executions today
grep "$(date +%Y-%m-%d)" /var/log/nonce-monitor/monitor.log | wc -l

# Count errors today
grep "$(date +%Y-%m-%d)" /var/log/nonce-monitor/monitor.log | grep ERROR | wc -l

# Count mismatches today
grep "$(date +%Y-%m-%d)" /var/log/nonce-monitor/monitor.log | grep "MISMATCH" | wc -l

# Show last 50 errors
grep ERROR /var/log/nonce-monitor/monitor.log | tail -50

# Show last 10 successful runs (summary only)
grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -10

# Extract latest summary statistics
grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -1

# Check log size
du -sh /var/log/nonce-monitor/

# Analyze log patterns
awk '{print $1, $2}' /var/log/nonce-monitor/monitor.log | sort | uniq -c
```

#### Automated Monitoring Script
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/check-health.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"
ERROR_THRESHOLD=5
MISMATCH_THRESHOLD=3

# Check errors in last hour
recent_errors=$(grep "$(date +%Y-%m-%d)" "$LOG_FILE" | grep ERROR | tail -60 | wc -l)
recent_mismatches=$(grep "$(date +%Y-%m-%d)" "$LOG_FILE" | grep "MISMATCH" | tail -60 | wc -l)

if [ "$recent_errors" -gt "$ERROR_THRESHOLD" ]; then
    echo "ALERT: High error rate detected ($recent_errors errors in last hour)"
fi

if [ "$recent_mismatches" -gt "$MISMATCH_THRESHOLD" ]; then
    echo "WARNING: Nonce mismatches detected ($recent_mismatches in last hour)"
fi
```

---

## Performance Tuning

### Expected Execution Times

**Baseline performance (per process):**
- Single process check: ~1-2 seconds
- Network latency: ~500ms per API call
- Concurrent processing: 5 processes per batch (default)

**Execution time by process count:**

| Processes | Sequential Time | Concurrent Time (batch=5) | Concurrent Time (batch=10) |
|-----------|-----------------|---------------------------|----------------------------|
| 1         | ~2s             | ~2s                       | ~2s                        |
| 5         | ~10s            | ~4s                       | ~4s                        |
| 10        | ~20s            | ~8s                       | ~4s                        |
| 25        | ~50s            | ~20s                      | ~10s                       |
| 50        | ~100s           | ~40s                      | ~20s                       |
| 100       | ~200s           | ~80s                      | ~40s                       |

### Recommendations for Large Deployments

#### Adjust Concurrent Batch Size

**Edit .env file:**
```bash
# For 10-50 processes
CONCURRENT_LIMIT=10

# For 50+ processes
CONCURRENT_LIMIT=15

# For 100+ processes
CONCURRENT_LIMIT=20
```

**Performance impact:**
- Higher concurrency = faster execution
- Too high concurrency = rate limiting risk
- Recommended: 10-20 concurrent requests

#### Optimize for Process Count

**Small deployment (1-10 processes):**
- Default settings are optimal
- Run every 5 minutes
- Expected execution: <10 seconds

**Medium deployment (10-50 processes):**
- Set `CONCURRENT_LIMIT=10`
- Run every 10-15 minutes
- Expected execution: 15-30 seconds

**Large deployment (50-100 processes):**
- Set `CONCURRENT_LIMIT=15`
- Run every 15-30 minutes
- Expected execution: 30-60 seconds

**Very large deployment (100+ processes):**
- Consider splitting into multiple instances
- See [Scaling Considerations](#scaling-considerations)

### Monitoring Execution Time

**Add timing to cron:**
```bash
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/time -f "Execution time: \%E" /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

**Check execution time from logs:**
```bash
# View recent execution times
grep "Execution time" /var/log/nonce-monitor/monitor.log | tail -10

# Calculate average execution time
grep "Execution time" /var/log/nonce-monitor/monitor.log | awk '{print $3}' | head -20
```

**Create performance monitoring script:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/monitor-performance.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"

echo "=== Performance Report ==="
echo "Last 10 execution summaries:"
grep "=== Summary" "$LOG_FILE" | tail -10

echo ""
echo "Average success rate (last 20 runs):"
grep "=== Summary" "$LOG_FILE" | tail -20 | awk -F'|' '{
    split($2, total, " ")
    split($3, success, " ")
    sum_total += total[2]
    sum_success += success[2]
}
END {
    if (sum_total > 0) {
        printf "%.1f%% success rate\n", (sum_success/sum_total)*100
    }
}'
```

### When to Split into Multiple Monitor Instances

**Consider splitting when:**
- Execution time exceeds 2 minutes consistently
- You need different monitoring frequencies for different process groups
- You have more than 100 processes
- You want to isolate critical processes

**Example split strategy:**
- Instance 1: Critical production processes (1-25 processes, every 5 min)
- Instance 2: Standard production processes (26-75 processes, every 15 min)
- Instance 3: Staging/test processes (76-100 processes, every 30 min)

See [Scaling Considerations](#scaling-considerations) for implementation details.

---

## Process Management

### Verify Cron is Running the Script

#### Check Cron Service Status
```bash
# Ubuntu/Debian
systemctl status cron

# RHEL/CentOS
systemctl status crond

# macOS
sudo launchctl list | grep cron
```

#### Verify Crontab Entry
```bash
# List current user's crontab
crontab -l

# Check system-wide cron jobs
ls -la /etc/cron.d/
ls -la /etc/cron.daily/
ls -la /etc/cron.hourly/
```

#### Monitor Cron Execution in Real-time
```bash
# Watch cron logs (Ubuntu/Debian)
tail -f /var/log/syslog | grep CRON

# Watch cron logs (RHEL/CentOS)
tail -f /var/log/cron

# Watch cron logs (macOS)
log stream --predicate 'process == "cron"' --info
```

#### Check Last Execution Time
```bash
# Check application log timestamp
tail -1 /var/log/nonce-monitor/monitor.log

# Check file modification time
ls -lh /var/log/nonce-monitor/monitor.log

# Watch for new entries (will show if cron runs)
watch -n 10 'tail -1 /var/log/nonce-monitor/monitor.log'
```

### How to Check Logs

#### Quick Status Check
```bash
# Last 20 lines
tail -20 /var/log/nonce-monitor/monitor.log

# Last 100 lines with less
tail -100 /var/log/nonce-monitor/monitor.log | less

# Show only today's logs
grep "$(date +%Y-%m-%d)" /var/log/nonce-monitor/monitor.log

# Show last hour
grep "$(date +%Y-%m-%d)" /var/log/nonce-monitor/monitor.log | tail -12
```

#### Interactive Log Viewing
```bash
# Use less for scrolling
less /var/log/nonce-monitor/monitor.log

# Use grep with context
grep -A 5 -B 5 ERROR /var/log/nonce-monitor/monitor.log

# Search within less (press '/' then type search term)
less /var/log/nonce-monitor/monitor.log
```

#### Generate Status Report
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/status-report.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"
TODAY=$(date +%Y-%m-%d)

echo "=== Nonce Monitor Status Report ==="
echo "Date: $TODAY"
echo ""
echo "Total Executions: $(grep "$TODAY" "$LOG_FILE" | wc -l)"
echo "Successful Matches: $(grep "$TODAY" "$LOG_FILE" | grep "MATCH ✓" | wc -l)"
echo "Mismatches: $(grep "$TODAY" "$LOG_FILE" | grep "MISMATCH ✗" | wc -l)"
echo "Errors: $(grep "$TODAY" "$LOG_FILE" | grep ERROR | wc -l)"
echo ""
echo "Last Execution:"
tail -1 "$LOG_FILE"
echo ""
echo "Recent Errors:"
grep "$TODAY" "$LOG_FILE" | grep ERROR | tail -5
```

### How to Debug Issues

#### Enable Debug Mode
```bash
# Run manually with verbose output
cd /opt/nonce-monitor
NODE_DEBUG=* npm start

# Check Node.js version compatibility
node --version

# Verify dependencies
npm list
```

#### Common Issues and Solutions

**Issue: Cron job not running**
```bash
# Check cron service
systemctl status cron

# Check user permissions
ls -la /opt/nonce-monitor/nonce-monitor.js

# Check PATH in cron
# Add to crontab:
PATH=/usr/local/bin:/usr/bin:/bin

# Use absolute paths
which node  # Use this path in crontab
```

**Issue: Permission denied**
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/nonce-monitor
sudo chown -R $USER:$USER /var/log/nonce-monitor

# Fix permissions
chmod +x /opt/nonce-monitor/nonce-monitor.js
chmod 644 /opt/nonce-monitor/.env
```

**Issue: Module not found**
```bash
# Reinstall dependencies
cd /opt/nonce-monitor
rm -rf node_modules package-lock.json
npm install

# Check Node.js module path
node -e "console.log(module.paths)"
```

**Issue: Network timeouts**
```bash
# Test connectivity
curl -v https://state.forward.computer
curl -v https://su-router.ao-testnet.xyz

# Increase timeout in .env
REQUEST_TIMEOUT=60000

# Check firewall
sudo ufw status
sudo iptables -L
```

**Issue: Environment variables not loaded**
```bash
# Use explicit env loading in cron
*/5 * * * * cd /opt/nonce-monitor && export $(cat .env | grep -v '^#' | xargs) && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1

# Or use dotenv in application
npm install dotenv
```

#### Create Debug Script
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/debug.sh

echo "=== Debug Information ==="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Working Directory: $(pwd)"
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo ""
echo "Environment:"
cat /opt/nonce-monitor/.env
echo ""
echo "Process Count:"
grep -v '^#' /opt/nonce-monitor/process-ids.txt | grep -v '^$' | wc -l
echo ""
echo "Crontab:"
crontab -l
echo ""
echo "Test Run:"
cd /opt/nonce-monitor && npm start
```

---

## Security Considerations

### File Permissions

```bash
# Secure application directory
chmod 750 /opt/nonce-monitor
chown -R $USER:$USER /opt/nonce-monitor

# Protect .env file (contains sensitive data including webhook URL)
chmod 600 /opt/nonce-monitor/.env
chown $USER:$USER /opt/nonce-monitor/.env

# Protect process-ids.txt
chmod 600 /opt/nonce-monitor/process-ids.txt
chown $USER:$USER /opt/nonce-monitor/process-ids.txt

# Secure log directory
chmod 755 /var/log/nonce-monitor
chown $USER:$USER /var/log/nonce-monitor

# Log files should not be world-readable if they contain sensitive info
chmod 640 /var/log/nonce-monitor/*.log
```

### Environment Variable Protection

```bash
# Never commit .env or process-ids.txt to version control
echo ".env" >> /opt/nonce-monitor/.gitignore
echo "process-ids.txt" >> /opt/nonce-monitor/.gitignore
echo "SLACK_WEBHOOK_URL" >> /opt/nonce-monitor/.gitignore

# Use secret management systems in enterprise environments
# Examples:
# - HashiCorp Vault
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager

# Example with AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id nonce-monitor/process-ids --query SecretString --output text
aws secretsmanager get-secret-value --secret-id nonce-monitor/slack-webhook --query SecretString --output text
```

### Slack Webhook Security

**Webhook URL protection is critical:**

```bash
# Verify .env permissions
ls -la /opt/nonce-monitor/.env
# Should show: -rw------- (600)

# Verify webhook URL is not in logs
grep -r "hooks.slack.com" /var/log/nonce-monitor/
# Should return no results (or only in error messages, not the full URL)

# Audit crontab for hardcoded webhooks
crontab -l | grep -i webhook
# Only environment variable references, not full URLs
```

**If webhook is compromised:**
1. Immediately revoke webhook in Slack App settings
2. Create new webhook in different channel
3. Update `.env` with new webhook URL
4. Restart monitoring
5. Review access logs to determine exposure scope
6. Consider rotating all secrets if broad exposure suspected

### Network Security

```bash
# Restrict outbound connections (using firewall)
sudo ufw allow out to any port 443 proto tcp comment 'HTTPS for nonce monitor'

# Monitor network connections
netstat -anp | grep node

# Use HTTPS only (already enforced in application)
# state.forward.computer and su-router.ao-testnet.xyz use HTTPS
```

### User Isolation

```bash
# Create dedicated user (recommended for production)
sudo useradd -r -s /bin/bash -d /opt/nonce-monitor -m nonce-monitor

# Set ownership
sudo chown -R nonce-monitor:nonce-monitor /opt/nonce-monitor
sudo chown -R nonce-monitor:nonce-monitor /var/log/nonce-monitor

# Set up cron for dedicated user
sudo crontab -u nonce-monitor -e
```

### Security Checklist

- ✅ Use dedicated non-root user
- ✅ Restrict file permissions (600 for .env and process-ids.txt, 750 for directories)
- ✅ Never commit secrets or process IDs to version control
- ✅ **Protect Slack webhook URL (treat as password)**
- ✅ Use HTTPS for all network requests
- ✅ Implement log rotation to prevent disk exhaustion
- ✅ Monitor for suspicious activity
- ✅ Keep Node.js and dependencies updated
- ✅ Implement rate limiting if exposed to external triggers
- ✅ Use firewall rules to restrict network access
- ✅ Regularly audit cron jobs and permissions
- ✅ **Store webhook URLs in environment variables or secrets vault**
- ✅ **Rotate webhooks if exposed or on regular schedule**

### Updating Dependencies Securely

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update packages
npm update

# Use specific versions in package.json
# Avoid using ^ or ~ for production dependencies
```

---

## Monitoring and Alerting

### Understanding Summary Metrics

The monitor outputs a summary line after each run:
```
=== Summary: 50 processes | 48 success | 2 failed | 0 errors ===
```

**Summary format breakdown:**
- `processes`: Total number of processes monitored
- `success`: Processes with matching nonces
- `failed`: Processes with mismatched nonces
- `errors`: Processes that encountered errors during check

### Parsing Summary from Logs

#### Extract Latest Summary
```bash
# Get latest summary
grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -1

# Parse summary values
latest_summary=$(grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -1)
total=$(echo "$latest_summary" | grep -oP '\d+(?= processes)')
success=$(echo "$latest_summary" | grep -oP '\d+(?= success)')
failed=$(echo "$latest_summary" | grep -oP '\d+(?= failed)')
errors=$(echo "$latest_summary" | grep -oP '\d+(?= errors)')

echo "Total: $total, Success: $success, Failed: $failed, Errors: $errors"
```

#### Calculate Failure Rate
```bash
#!/bin/bash
# Extract and calculate failure rate from latest summary

latest_summary=$(grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -1)
total=$(echo "$latest_summary" | grep -oP '\d+(?= processes)')
failed=$(echo "$latest_summary" | grep -oP '\d+(?= failed)')
errors=$(echo "$latest_summary" | grep -oP '\d+(?= errors)')

if [ "$total" -gt 0 ]; then
    failure_count=$((failed + errors))
    failure_rate=$(echo "scale=2; ($failure_count / $total) * 100" | bc)
    echo "Failure rate: ${failure_rate}%"
fi
```

### Alert on Summary Metrics

#### Alert Script Based on Thresholds
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/summary-alert.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"
FAILURE_THRESHOLD=50  # Alert if >50% failures
MIN_PROCESSES=5       # Only alert if monitoring at least 5 processes

# Extract latest summary
latest_summary=$(grep "=== Summary" "$LOG_FILE" | tail -1)
total=$(echo "$latest_summary" | grep -oP '\d+(?= processes)')
failed=$(echo "$latest_summary" | grep -oP '\d+(?= failed)')
errors=$(echo "$latest_summary" | grep -oP '\d+(?= errors)')

# Calculate failure rate
if [ "$total" -ge "$MIN_PROCESSES" ]; then
    failure_count=$((failed + errors))
    failure_rate=$(echo "scale=0; ($failure_count * 100) / $total" | bc)
    
    if [ "$failure_rate" -gt "$FAILURE_THRESHOLD" ]; then
        echo "ALERT: High failure rate detected!"
        echo "$latest_summary"
        echo "Failure rate: ${failure_rate}%"
        
        # Add alerting mechanism (email, Slack, PagerDuty, etc.)
        # Example: send email
        # echo "$latest_summary" | mail -s "Nonce Monitor Alert: ${failure_rate}% failure rate" admin@example.com
    fi
fi
```

**Add to crontab (run after main monitoring):**
```bash
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
*/5 * * * * /opt/nonce-monitor/scripts/summary-alert.sh
```

### Example Grep Commands for Summary Analysis

```bash
# Get all summaries from today
grep "$(date +%Y-%m-%d)" /var/log/nonce-monitor/monitor.log | grep "=== Summary"

# Count how many times success rate was 100%
grep "=== Summary" /var/log/nonce-monitor/monitor.log | grep "| 0 failed | 0 errors" | wc -l

# Find all runs with failures
grep "=== Summary" /var/log/nonce-monitor/monitor.log | grep -v "| 0 failed |"

# Find all runs with errors
grep "=== Summary" /var/log/nonce-monitor/monitor.log | grep -v "| 0 errors ==="

# Get average success rate (last 20 runs)
grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -20 | awk -F'|' '{
    split($2, total, " ")
    split($3, success, " ")
    sum_total += total[2]
    sum_success += success[2]
}
END {
    if (sum_total > 0) {
        printf "Average success rate: %.1f%%\n", (sum_success/sum_total)*100
    }
}'
```

### Email Notifications

#### Configure Mail in Cron
```bash
# Install mailutils
sudo apt-get install mailutils  # Ubuntu/Debian
sudo yum install mailx          # RHEL/CentOS

# Add MAILTO to crontab
MAILTO=admin@example.com
MAILFROM=nonce-monitor@example.com

*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

#### Custom Email Alert Script with Summary Parsing
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/email-alert.sh

LOG_FILE="/var/log/nonce-monitor/monitor.log"
ALERT_EMAIL="admin@example.com"
SUBJECT="Nonce Monitor Alert"

# Get latest summary
latest_summary=$(grep "=== Summary" "$LOG_FILE" | tail -1)
failed=$(echo "$latest_summary" | grep -oP '\d+(?= failed)')
errors=$(echo "$latest_summary" | grep -oP '\d+(?= errors)')

if [ "$failed" -gt 0 ] || [ "$errors" -gt 0 ]; then
    echo "$latest_summary" | mail -s "$SUBJECT - Failures Detected" "$ALERT_EMAIL"
fi
```

### Slack Integration

**Note:** Slack webhook integration is built into the nonce monitor application. When `SLACK_WEBHOOK_URL` is configured, alerts are automatically sent on nonce mismatches. The script below is for custom threshold-based alerting.

```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/slack-notify.sh
# Custom alerting script for threshold-based notifications

# Load webhook from .env or use environment variable
if [ -f /opt/nonce-monitor/.env ]; then
    source <(grep SLACK_WEBHOOK_URL /opt/nonce-monitor/.env)
fi

LOG_FILE="/var/log/nonce-monitor/monitor.log"
FAILURE_THRESHOLD=20  # Alert if >20% failures

latest_summary=$(grep "=== Summary" "$LOG_FILE" | tail -1)
total=$(echo "$latest_summary" | grep -oP '\d+(?= processes)')
failed=$(echo "$latest_summary" | grep -oP '\d+(?= failed)')
errors=$(echo "$latest_summary" | grep -oP '\d+(?= errors)')

if [ "$total" -gt 0 ]; then
    failure_count=$((failed + errors))
    failure_rate=$(echo "scale=0; ($failure_count * 100) / $total" | bc)
    
    if [ "$failure_rate" -gt "$FAILURE_THRESHOLD" ]; then
        message="🚨 Nonce Monitor Alert: ${failure_rate}% failure rate\n$latest_summary"
        curl -X POST "$SLACK_WEBHOOK_URL" \
             -H 'Content-Type: application/json' \
             -d "{\"text\":\"$message\"}"
    fi
fi
```

**Add to crontab after main job (optional):**
```bash
*/5 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
*/5 * * * * /opt/nonce-monitor/scripts/slack-notify.sh
```

**Primary integration method (recommended):**
Slack notifications are sent automatically by the application when mismatches are detected if `SLACK_WEBHOOK_URL` is configured in `.env`.

### PagerDuty Integration

```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/pagerduty-alert.sh

ROUTING_KEY="your-pagerduty-routing-key"
LOG_FILE="/var/log/nonce-monitor/monitor.log"

latest_summary=$(grep "=== Summary" "$LOG_FILE" | tail -1)
errors=$(echo "$latest_summary" | grep -oP '\d+(?= errors)')

if [ "$errors" -gt 0 ]; then
    curl -X POST https://events.pagerduty.com/v2/enqueue \
         -H 'Content-Type: application/json' \
         -d "{
               \"routing_key\": \"$ROUTING_KEY\",
               \"event_action\": \"trigger\",
               \"payload\": {
                 \"summary\": \"Nonce Monitor Errors: $errors processes failed\",
                 \"severity\": \"error\",
                 \"source\": \"nonce-monitor\",
                 \"custom_details\": {
                   \"summary\": \"$latest_summary\"
                 }
               }
             }"
fi
```

### Prometheus Metrics (Advanced)

**Create metrics exporter:**
```javascript
// /opt/nonce-monitor/metrics-exporter.js
import { createServer } from 'http';
import { readFileSync } from 'fs';

const PORT = 9100;
const LOG_FILE = '/var/log/nonce-monitor/monitor.log';

function parseMetrics() {
    const logs = readFileSync(LOG_FILE, 'utf8').split('\n');
    const today = new Date().toISOString().split('T')[0];
    
    let matches = 0;
    let mismatches = 0;
    let errors = 0;
    
    logs.forEach(line => {
        if (line.includes(today)) {
            if (line.includes('MATCH ✓')) matches++;
            if (line.includes('MISMATCH ✗')) mismatches++;
            if (line.includes('ERROR')) errors++;
        }
    });
    
    return `# HELP nonce_monitor_matches_total Total successful matches
# TYPE nonce_monitor_matches_total counter
nonce_monitor_matches_total ${matches}

# HELP nonce_monitor_mismatches_total Total mismatches
# TYPE nonce_monitor_mismatches_total counter
nonce_monitor_mismatches_total ${mismatches}

# HELP nonce_monitor_errors_total Total errors
# TYPE nonce_monitor_errors_total counter
nonce_monitor_errors_total ${errors}
`;
}

createServer((req, res) => {
    if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(parseMetrics());
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT);

console.log(`Metrics server running on port ${PORT}`);
```

### Health Check Endpoint

```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/health-check.sh
# Returns 0 if healthy, 1 if unhealthy

LOG_FILE="/var/log/nonce-monitor/monitor.log"
MAX_AGE_MINUTES=10

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "UNHEALTHY: Log file not found"
    exit 1
fi

# Check last update time
last_modified=$(stat -c %Y "$LOG_FILE" 2>/dev/null || stat -f %m "$LOG_FILE" 2>/dev/null)
current_time=$(date +%s)
age_minutes=$(( (current_time - last_modified) / 60 ))

if [ $age_minutes -gt $MAX_AGE_MINUTES ]; then
    echo "UNHEALTHY: No updates in $age_minutes minutes"
    exit 1
fi

# Check for recent errors
recent_errors=$(tail -20 "$LOG_FILE" | grep ERROR | wc -l)
if [ $recent_errors -gt 5 ]; then
    echo "UNHEALTHY: Too many recent errors ($recent_errors)"
    exit 1
fi

echo "HEALTHY"
exit 0
```

---

## Slack Integration Best Practices

### Channel Selection

**Use dedicated monitoring channels:**

**Recommended channel naming:**
- `#ao-monitoring` - Primary production alerts
- `#ao-alerts` - Critical alerts only
- `#ao-nonce-monitor` - Specific to nonce monitoring
- `#alerts-dev` - Development/staging alerts
- `#alerts-critical` - High-priority production issues

**Don't use general channels:**
- ❌ `#general` - Too noisy, alerts will be missed
- ❌ `#random` - Not appropriate for production alerts
- ❌ `#engineering` - Too broad, lacks focus
- ✅ Use dedicated, purpose-specific channels

**Channel notification configuration:**
```
1. Go to channel settings
2. Set notification preferences:
   - Desktop: All messages (for critical channels)
   - Mobile: All messages (for critical channels)
   - Mute channel: Never (for alert channels)
3. Pin important documentation to channel
4. Set channel topic with monitoring details
```

**Example channel topic:**
```
AO Network Nonce Monitor | Checks every 5 min | Alerts on mismatch | Oncall: @devops
```

### Separate Webhooks for Different Environments

**Best practice: Use different webhooks for each environment**

**Production setup:**
```bash
# /opt/nonce-monitor/prod/.env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/PROD/WEBHOOK/URL
# Sends to #ao-monitoring (critical alerts)
```

**Staging setup:**
```bash
# /opt/nonce-monitor/staging/.env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/STAGING/WEBHOOK/URL
# Sends to #ao-alerts-staging (non-critical)
```

**Development setup:**
```bash
# /opt/nonce-monitor/dev/.env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/DEV/WEBHOOK/URL
# Sends to #alerts-dev (informational)
```

**Benefits:**
- Clear separation of concerns
- Different notification settings per environment
- Easy to mute non-critical channels
- Better incident response (know severity immediately)

### Webhook URL Documentation and Storage

**Where to store webhook URLs:**

**Option 1: Password manager (recommended for small teams)**
```
1Password, LastPass, Bitwarden entry:
Title: AO Nonce Monitor - Slack Webhook (Production)
URL: https://hooks.slack.com/services/[REDACTED]
Channel: #ao-monitoring
Environment: Production
Created: 2025-10-03
```

**Option 2: Secrets vault (recommended for teams)**
```bash
# HashiCorp Vault
vault kv put secret/nonce-monitor/prod/slack \
    webhook_url="https://hooks.slack.com/services/..." \
    channel="#ao-monitoring" \
    environment="production"

# AWS Secrets Manager
aws secretsmanager create-secret \
    --name nonce-monitor/prod/slack-webhook \
    --description "Slack webhook for production nonce monitoring" \
    --secret-string '{"webhook_url":"https://hooks.slack.com/services/...","channel":"#ao-monitoring"}'
```

**Option 3: Team documentation (metadata only, not URLs)**
```markdown
# Nonce Monitor Slack Configuration

## Webhook Locations
- **Production**: Stored in 1Password vault "DevOps Secrets"
- **Staging**: Stored in AWS Secrets Manager (us-east-1)
- **Development**: In .env file on dev server

## Channel Mapping
- Production → #ao-monitoring
- Staging → #ao-alerts-staging  
- Development → #alerts-dev

## Access
- Webhook creation: @devops-admins
- Channel management: @devops-team
```

**Documentation checklist:**
- ✅ Document webhook storage location (not the URL itself)
- ✅ Document channel mapping
- ✅ Document who has access
- ✅ Document rotation schedule
- ✅ Document oncall/escalation procedures
- ❌ Never document actual webhook URLs in wikis/docs

### Managing Notification Volume

**For high-frequency monitoring:**

**Problem:** Too many alerts create noise and alert fatigue

**Solutions:**

**1. Batch notifications:**
```bash
#!/bin/bash
# Send summary notification instead of per-mismatch alerts
# Run hourly instead of per-check

LOG_FILE="/var/log/nonce-monitor/monitor.log"
HOUR_AGO=$(date -d '1 hour ago' '+%Y-%m-%d %H')

# Count mismatches in last hour
mismatches=$(grep "$HOUR_AGO" "$LOG_FILE" | grep "MISMATCH" | wc -l)

if [ "$mismatches" -gt 0 ]; then
    message="📊 Hourly Summary: $mismatches nonce mismatches detected in the last hour"
    curl -X POST "$SLACK_WEBHOOK_URL" \
         -H 'Content-Type: application/json' \
         -d "{\"text\":\"$message\"}"
fi
```

**2. Threshold-based alerts:**
```bash
# Only alert if failure rate exceeds threshold
# See example in Monitoring and Alerting section
FAILURE_THRESHOLD=50  # Alert only if >50% failures
```

**3. Suppress repeated alerts:**
```bash
#!/bin/bash
# Suppress duplicate alerts for same process

ALERT_CACHE="/tmp/nonce-monitor-alerts"
mkdir -p "$ALERT_CACHE"

PROCESS_ID=$1
CACHE_FILE="$ALERT_CACHE/$PROCESS_ID"

# Check if we alerted recently (within 1 hour)
if [ -f "$CACHE_FILE" ]; then
    last_alert=$(cat "$CACHE_FILE")
    current_time=$(date +%s)
    time_diff=$((current_time - last_alert))
    
    # Don't alert if less than 1 hour since last alert
    if [ $time_diff -lt 3600 ]; then
        exit 0
    fi
fi

# Send alert and cache timestamp
# [alert sending code here]
date +%s > "$CACHE_FILE"
```

**4. Use notification priorities:**
```bash
# Critical alerts (immediate notification)
curl -X POST "$SLACK_WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d '{"text":"🚨 CRITICAL: Multiple process failures detected","priority":"high"}'

# Warning alerts (normal notification)
curl -X POST "$SLACK_WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d '{"text":"⚠️  Warning: Single process mismatch"}'

# Info alerts (low priority)
curl -X POST "$SLACK_WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d '{"text":"ℹ️  Info: Monitoring resumed after maintenance"}'
```

### Alert Message Best Practices

**Good alert format:**
```json
{
  "text": "🚨 Nonce Mismatch Detected",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Nonce Mismatch Alert*\n*Process:* `0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLLSrsc`\n*State Nonce:* 12345\n*Router Nonce:* 12346\n*Environment:* Production\n*Time:* 2025-10-03 14:23:15 UTC"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "View Logs"},
          "url": "https://your-server.com/logs"
        }
      ]
    }
  ]
}
```

**Include key information:**
- Clear severity indicator (emoji or text)
- Affected process ID
- Actual vs expected values
- Environment (prod/staging/dev)
- Timestamp
- Link to runbook or logs (if available)

---

## Scaling Considerations

### Single Instance Deployment (1-50 processes)

**Recommended for:**
- Small to medium deployments
- Unified monitoring schedule
- Simple management

**Configuration:**
```bash
# Single process-ids.txt file
/opt/nonce-monitor/process-ids.txt

# Single cron job
*/10 * * * * cd /opt/nonce-monitor && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/monitor.log 2>&1
```

**Advantages:**
- Simple setup and management
- Single log file to monitor
- Easy to understand and debug

**Limitations:**
- All processes on same schedule
- Single point of failure
- Limited scalability

### Multiple Instance Deployment (Split Process Lists)

**Recommended for:**
- Large deployments (50-200+ processes)
- Different monitoring schedules per process group
- Isolation of critical vs non-critical processes

**Directory structure:**
```
/opt/nonce-monitor/
├── instance-critical/
│   ├── process-ids.txt
│   ├── nonce-monitor.js
│   └── .env
├── instance-standard/
│   ├── process-ids.txt
│   ├── nonce-monitor.js
│   └── .env
└── instance-testing/
    ├── process-ids.txt
    ├── nonce-monitor.js
    └── .env
```

**Setup script:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/setup-multi-instance.sh

# Create instance directories
mkdir -p /opt/nonce-monitor/instance-{critical,standard,testing}

# Copy files to each instance
for instance in critical standard testing; do
    cp /opt/nonce-monitor/nonce-monitor.js "/opt/nonce-monitor/instance-$instance/"
    cp /opt/nonce-monitor/.env "/opt/nonce-monitor/instance-$instance/"
    cp /opt/nonce-monitor/package.json "/opt/nonce-monitor/instance-$instance/"
    touch "/opt/nonce-monitor/instance-$instance/process-ids.txt"
done

# Install dependencies for each instance
for instance in critical standard testing; do
    cd "/opt/nonce-monitor/instance-$instance"
    npm install --production
done

echo "Multi-instance setup complete"
```

**Crontab for multiple instances:**
```bash
# Critical processes - every 5 minutes
*/5 * * * * cd /opt/nonce-monitor/instance-critical && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/critical.log 2>&1

# Standard processes - every 15 minutes
*/15 * * * * cd /opt/nonce-monitor/instance-standard && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/standard.log 2>&1

# Testing processes - every 30 minutes
*/30 * * * * cd /opt/nonce-monitor/instance-testing && /usr/bin/node nonce-monitor.js >> /var/log/nonce-monitor/testing.log 2>&1
```

### Load Balancing Strategies

#### Round-Robin Distribution

**Split process list into equal chunks:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/split-process-list.sh

SOURCE_FILE="/opt/nonce-monitor/all-process-ids.txt"
INSTANCES=3
INSTANCE_DIR="/opt/nonce-monitor"

# Get total process count (excluding comments and empty lines)
total_processes=$(grep -v '^#' "$SOURCE_FILE" | grep -v '^$' | wc -l)
per_instance=$((total_processes / INSTANCES))

echo "Splitting $total_processes processes into $INSTANCES instances (~$per_instance each)"

# Split file
grep -v '^#' "$SOURCE_FILE" | grep -v '^$' | split -l $per_instance - "$INSTANCE_DIR/processes-"

# Rename and move to instances
counter=1
for file in "$INSTANCE_DIR"/processes-*; do
    mv "$file" "$INSTANCE_DIR/instance-$counter/process-ids.txt"
    ((counter++))
done

echo "Process list split complete"
```

#### Priority-Based Distribution

**Organize by criticality:**
```bash
# instance-critical/process-ids.txt
# High-priority production processes (check every 5 min)
critical-process-id-1
critical-process-id-2

# instance-standard/process-ids.txt
# Standard production processes (check every 15 min)
standard-process-id-1
standard-process-id-2
standard-process-id-3

# instance-testing/process-ids.txt
# Non-critical and testing processes (check every 30 min)
test-process-id-1
test-process-id-2
```

#### Geographic Distribution

**Split by region/network:**
```bash
# instance-us-east/process-ids.txt
# US East processes

# instance-eu-west/process-ids.txt
# EU West processes

# instance-ap-south/process-ids.txt
# Asia Pacific processes
```

### Scaling Guidelines

#### When to Use Single Instance
- **1-50 processes**: Single instance is optimal
- **Uniform monitoring needs**: All processes need same check frequency
- **Simple operations**: Team prefers single configuration

#### When to Use Multiple Instances
- **50+ processes**: Consider splitting for performance
- **Different SLAs**: Critical processes need more frequent checks
- **Isolation needs**: Separate production, staging, and testing
- **Team structure**: Different teams own different process groups

#### Scaling Thresholds

| Process Count | Recommended Strategy | Instances | Frequency |
|---------------|---------------------|-----------|-----------|
| 1-25          | Single instance     | 1         | 5-10 min  |
| 25-50         | Single instance     | 1         | 10-15 min |
| 50-100        | Split by priority   | 2-3       | Varies    |
| 100-200       | Split by priority   | 3-5       | Varies    |
| 200+          | Regional/team split | 5+        | Varies    |

### Multi-Instance Monitoring

**Unified monitoring script:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/unified-status.sh

echo "=== Multi-Instance Status Report ==="
echo "Date: $(date)"
echo ""

for instance_dir in /opt/nonce-monitor/instance-*/; do
    instance_name=$(basename "$instance_dir")
    log_file="/var/log/nonce-monitor/${instance_name}.log"
    
    if [ -f "$log_file" ]; then
        echo "[$instance_name]"
        echo "  Last run: $(grep "=== Summary" "$log_file" | tail -1)"
        echo ""
    fi
done

# Calculate totals
echo "=== Overall Statistics ==="
total_processes=0
total_success=0
total_failed=0
total_errors=0

for log_file in /var/log/nonce-monitor/*.log; do
    if [ -f "$log_file" ]; then
        latest=$(grep "=== Summary" "$log_file" | tail -1)
        processes=$(echo "$latest" | grep -oP '\d+(?= processes)' || echo 0)
        success=$(echo "$latest" | grep -oP '\d+(?= success)' || echo 0)
        failed=$(echo "$latest" | grep -oP '\d+(?= failed)' || echo 0)
        errors=$(echo "$latest" | grep -oP '\d+(?= errors)' || echo 0)
        
        total_processes=$((total_processes + processes))
        total_success=$((total_success + success))
        total_failed=$((total_failed + failed))
        total_errors=$((total_errors + errors))
    fi
done

echo "Total processes: $total_processes"
echo "Total success: $total_success"
echo "Total failed: $total_failed"
echo "Total errors: $total_errors"

if [ $total_processes -gt 0 ]; then
    success_rate=$(echo "scale=1; ($total_success * 100) / $total_processes" | bc)
    echo "Overall success rate: ${success_rate}%"
fi
```

### Maintenance and Updates

**Update all instances:**
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/update-all-instances.sh

for instance_dir in /opt/nonce-monitor/instance-*/; do
    echo "Updating $(basename "$instance_dir")..."
    cd "$instance_dir"
    
    # Update code
    cp /opt/nonce-monitor/nonce-monitor.js .
    
    # Update dependencies
    npm install --production
    
    # Test
    npm start
    
    echo "$(basename "$instance_dir") updated successfully"
done
```

---

## Backup and Recovery

### Configuration Backup

```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/backup-config.sh

BACKUP_DIR="/opt/nonce-monitor/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/config-backup-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

# Backup configuration files
tar -czf "$BACKUP_FILE" \
    /opt/nonce-monitor/.env \
    /opt/nonce-monitor/process-ids.txt \
    /opt/nonce-monitor/package.json \
    /opt/nonce-monitor/nonce-monitor.js

# Backup crontab
crontab -l > "$BACKUP_DIR/crontab-backup-$TIMESTAMP.txt"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.txt" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE"
```

**Schedule daily backups:**
```bash
0 3 * * * /opt/nonce-monitor/scripts/backup-config.sh >> /var/log/nonce-monitor/backup.log 2>&1
```

### Log Backup

```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/backup-logs.sh

LOG_DIR="/var/log/nonce-monitor"
BACKUP_DIR="/opt/nonce-monitor/log-backups"
TIMESTAMP=$(date +%Y%m%d)

mkdir -p "$BACKUP_DIR"

# Compress and backup logs
tar -czf "$BACKUP_DIR/logs-$TIMESTAMP.tar.gz" "$LOG_DIR"/*.log

# Optional: Upload to cloud storage
# aws s3 cp "$BACKUP_DIR/logs-$TIMESTAMP.tar.gz" s3://your-bucket/nonce-monitor/logs/
# gsutil cp "$BACKUP_DIR/logs-$TIMESTAMP.tar.gz" gs://your-bucket/nonce-monitor/logs/

# Keep only last 90 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +90 -delete

echo "Log backup created: logs-$TIMESTAMP.tar.gz"
```

### Disaster Recovery Plan

#### 1. Document Current State
```bash
# Save system information
cat > /opt/nonce-monitor/SYSTEM_INFO.txt <<EOF
Node Version: $(node --version)
NPM Version: $(npm --version)
OS: $(uname -a)
Application Path: $(pwd)
Process Count: $(grep -v '^#' /opt/nonce-monitor/process-ids.txt | grep -v '^$' | wc -l)
Cron Schedule: $(crontab -l | grep nonce-monitor)
EOF
```

#### 2. Full System Backup Script
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/full-backup.sh

BACKUP_DIR="/opt/nonce-monitor/full-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="full-backup-$TIMESTAMP"

mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Backup application
cp -r /opt/nonce-monitor "$BACKUP_DIR/$BACKUP_NAME/application"

# Backup logs
cp -r /var/log/nonce-monitor "$BACKUP_DIR/$BACKUP_NAME/logs"

# Backup crontab
crontab -l > "$BACKUP_DIR/$BACKUP_NAME/crontab.txt"

# Backup system info
node --version > "$BACKUP_DIR/$BACKUP_NAME/node-version.txt"
npm list --depth=0 > "$BACKUP_DIR/$BACKUP_NAME/dependencies.txt"

# Create archive
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

echo "Full backup created: $BACKUP_NAME.tar.gz"
```

#### 3. Recovery Procedure
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

echo "Starting restore from $BACKUP_FILE..."

# Extract backup
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore application
sudo cp -r "$TEMP_DIR"/*/application/* /opt/nonce-monitor/

# Restore crontab
crontab "$TEMP_DIR"/*/crontab.txt

# Reinstall dependencies
cd /opt/nonce-monitor
npm install

# Verify installation
npm start

echo "Restore completed. Please verify configuration."
```

### Cloud Backup Integration

#### AWS S3 Backup
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/backup-to-s3.sh

BUCKET="your-backup-bucket"
PREFIX="nonce-monitor"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create backup
/opt/nonce-monitor/scripts/full-backup.sh

# Upload to S3
LATEST_BACKUP=$(ls -t /opt/nonce-monitor/full-backups/*.tar.gz | head -1)
aws s3 cp "$LATEST_BACKUP" "s3://$BUCKET/$PREFIX/backups/$TIMESTAMP.tar.gz"

# Upload logs
aws s3 sync /var/log/nonce-monitor/ "s3://$BUCKET/$PREFIX/logs/" --exclude "*" --include "*.log"

echo "Backup uploaded to S3"
```

#### Automated Recovery Testing
```bash
#!/bin/bash
# /opt/nonce-monitor/scripts/test-recovery.sh

TEST_DIR=$(mktemp -d)
LATEST_BACKUP=$(ls -t /opt/nonce-monitor/full-backups/*.tar.gz | head -1)

echo "Testing recovery with $LATEST_BACKUP in $TEST_DIR"

# Extract and verify
tar -xzf "$LATEST_BACKUP" -C "$TEST_DIR"
cd "$TEST_DIR"/*/application

# Install and test
npm install
npm start

if [ $? -eq 0 ]; then
    echo "Recovery test PASSED"
    rm -rf "$TEST_DIR"
    exit 0
else
    echo "Recovery test FAILED"
    rm -rf "$TEST_DIR"
    exit 1
fi
```

---

## Quick Reference

### Essential Commands
```bash
# Start manually
cd /opt/nonce-monitor && npm start

# Edit crontab
crontab -e

# View logs
tail -f /var/log/nonce-monitor/monitor.log

# View latest summary
grep "=== Summary" /var/log/nonce-monitor/monitor.log | tail -1

# Check cron status
systemctl status cron

# Test configuration
npm start

# View recent errors
grep ERROR /var/log/nonce-monitor/monitor.log | tail -20

# Count active processes
grep -v '^#' /opt/nonce-monitor/process-ids.txt | grep -v '^$' | wc -l
```

### File Locations
- Application: `/opt/nonce-monitor/`
- Configuration: `/opt/nonce-monitor/.env`
- Process list: `/opt/nonce-monitor/process-ids.txt`
- Logs: `/var/log/nonce-monitor/monitor.log`
- Crontab: `crontab -l`
- Logrotate config: `/etc/logrotate.d/nonce-monitor`

### Support and Troubleshooting
For issues, check:
1. Application logs: `/var/log/nonce-monitor/monitor.log`
2. Cron logs: `/var/log/syslog` or `/var/log/cron`
3. System status: `systemctl status cron`
4. Manual test: `npm start`
5. Process count: `grep -v '^#' process-ids.txt | grep -v '^$' | wc -l`

---

## Troubleshooting

### Slack Integration Issues

#### Slack Messages Not Appearing

**Possible causes and solutions:**

**1. Webhook URL not configured:**
```bash
# Check if webhook is set
grep SLACK_WEBHOOK_URL /opt/nonce-monitor/.env

# Should return:
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# If empty, add webhook:
echo "SLACK_WEBHOOK_URL=your-webhook-url" >> /opt/nonce-monitor/.env
```

**2. Webhook URL invalid or revoked:**
```bash
# Test webhook manually
WEBHOOK_URL=$(grep SLACK_WEBHOOK_URL /opt/nonce-monitor/.env | cut -d'=' -f2)

curl -X POST "$WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test message"}'

# Expected response: "ok"
# If response is "invalid_token" or "channel_not_found": recreate webhook
```

**3. Network connectivity issues:**
```bash
# Test connectivity to Slack
curl -I https://hooks.slack.com

# Expected: HTTP/2 200 or 301

# Check firewall rules
sudo iptables -L | grep -i slack
sudo ufw status | grep -i https

# Ensure outbound HTTPS (443) is allowed
```

**4. Cron environment not loading .env:**
```bash
# Fix: Explicitly load environment in crontab
crontab -e

# Change from:
*/5 * * * * cd /opt/nonce-monitor && node nonce-monitor.js

# To:
*/5 * * * * cd /opt/nonce-monitor && export $(grep -v '^#' .env | xargs) && node nonce-monitor.js
```

**5. Permission issues:**
```bash
# Verify .env is readable by cron user
ls -la /opt/nonce-monitor/.env

# Should show readable permissions for user
# Fix if needed:
chmod 600 /opt/nonce-monitor/.env
chown $USER:$USER /opt/nonce-monitor/.env
```

#### Webhook URL Invalid Error

**Symptoms:**
- Application logs show "webhook invalid" or "unauthorized"
- Curl test returns error response

**Solutions:**

**1. Recreate webhook:**
```
1. Go to https://api.slack.com/apps
2. Select your app
3. Click "Incoming Webhooks"
4. Delete old webhook
5. Click "Add New Webhook to Workspace"
6. Select channel
7. Copy new URL
8. Update .env file
```

**2. Verify webhook format:**
```bash
# Correct format:
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Should have three segments after /services/
# If format is different, webhook might be corrupted
```

**3. Check if webhook was disabled:**
```
1. Go to Slack App settings
2. Check if "Incoming Webhooks" is still enabled (toggle should be ON)
3. If disabled, re-enable and create new webhook
```

#### Rate Limiting Issues

**Symptoms:**
- Some messages not delivered
- Slack API returns 429 error
- Logs show "too_many_requests"

**Slack rate limits:**
- **Per-webhook limit:** ~1 message per second
- **Burst limit:** Allow brief bursts, then throttle

**Solutions:**

**1. Reduce notification frequency:**
```bash
# Instead of per-check notifications, use hourly summaries
# See "Managing Notification Volume" section above
```

**2. Implement rate limiting in script:**
```bash
#!/bin/bash
# Rate-limited Slack notification

RATE_LIMIT_FILE="/tmp/slack-rate-limit"
RATE_LIMIT_SECONDS=5  # Maximum 1 message per 5 seconds

# Check last send time
if [ -f "$RATE_LIMIT_FILE" ]; then
    last_send=$(cat "$RATE_LIMIT_FILE")
    current_time=$(date +%s)
    time_diff=$((current_time - last_send))
    
    if [ $time_diff -lt $RATE_LIMIT_SECONDS ]; then
        echo "Rate limit: waiting $(($RATE_LIMIT_SECONDS - $time_diff)) seconds"
        sleep $(($RATE_LIMIT_SECONDS - $time_diff))
    fi
fi

# Send message
curl -X POST "$SLACK_WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d "$MESSAGE"

# Update rate limit file
date +%s > "$RATE_LIMIT_FILE"
```

**3. Use message batching:**
```bash
# Collect multiple alerts and send as single message
# Instead of 10 separate messages, send 1 message with 10 items
```

**4. Queue messages:**
```bash
#!/bin/bash
# Queue messages and send in batches

QUEUE_DIR="/tmp/slack-queue"
mkdir -p "$QUEUE_DIR"

# Add message to queue
MESSAGE_FILE="$QUEUE_DIR/$(date +%s%N).json"
echo "$MESSAGE" > "$MESSAGE_FILE"

# Process queue (run separately, e.g., every minute)
# /opt/nonce-monitor/scripts/process-slack-queue.sh
```

#### Message Formatting Problems

**Symptoms:**
- Messages appear garbled
- Markdown not rendering
- Links not working

**Solutions:**

**1. Use proper JSON escaping:**
```bash
# Bad:
MESSAGE='{"text":"Process ID: abc"def"}'

# Good:
MESSAGE='{"text":"Process ID: abc\"def"}'

# Or use jq for safe JSON generation:
MESSAGE=$(jq -n --arg text "Process ID: $PROCESS_ID" '{text: $text}')
```

**2. Escape special characters:**
```bash
# Escape newlines
MESSAGE=$(echo "$TEXT" | sed ':a;N;$!ba;s/\n/\\n/g')

# Use printf for multi-line messages
MESSAGE=$(printf '{"text":"Line 1\\nLine 2\\nLine 3"}')
```

**3. Use Slack Block Kit for rich formatting:**
```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d '{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Bold* _italic_ `code` [link](https://example.com)"
      }
    }
  ]
}'
```

**4. Test messages with curl first:**
```bash
# Create test message file
cat > /tmp/test-message.json <<EOF
{
  "text": "Test message with *formatting*"
}
EOF

# Send test
curl -X POST "$SLACK_WEBHOOK_URL" \
     -H 'Content-Type: application/json' \
     -d @/tmp/test-message.json
```

### General Troubleshooting

**Enable debug logging:**
```bash
# Run monitor with debug output
cd /opt/nonce-monitor
NODE_DEBUG=* npm start 2>&1 | tee debug.log
```

**Check cron execution:**
```bash
# Monitor cron logs in real-time
tail -f /var/log/syslog | grep CRON  # Ubuntu/Debian
tail -f /var/log/cron                # RHEL/CentOS
```

**Verify environment variables:**
```bash
# Print all environment variables in cron context
* * * * * env > /tmp/cron-env.txt

# Check after 1 minute
cat /tmp/cron-env.txt | grep SLACK
```

**Test full workflow:**
```bash
# Simulate cron environment
env -i SHELL=/bin/bash PATH=/usr/bin:/bin HOME=/home/$USER \
    bash -c "cd /opt/nonce-monitor && export \$(grep -v '^#' .env | xargs) && node nonce-monitor.js"
```

### Getting Help

**Information to collect before seeking help:**

1. **System information:**
   ```bash
   node --version
   npm --version
   uname -a
   ```

2. **Application logs:**
   ```bash
   tail -100 /var/log/nonce-monitor/monitor.log
   ```

3. **Crontab configuration:**
   ```bash
   crontab -l
   ```

4. **Environment (sanitized):**
   ```bash
   # Show .env without sensitive values
   grep -v 'WEBHOOK' /opt/nonce-monitor/.env
   ```

5. **Error reproduction:**
   ```bash
   cd /opt/nonce-monitor
   npm start 2>&1
   ```

**Support resources:**
- Application repository issues
- Team documentation
- DevOps team contact
- Slack workspace admins (for webhook issues)

---

*Last Updated: 2025-10-03*
