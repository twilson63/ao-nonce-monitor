# GitHub Secrets Configuration

This document describes all GitHub Secrets required to run the Nonce Monitor workflow.

## Required Secrets

### PROCESS_ID

**Required:** Yes

**Description:** The unique identifier for the process to monitor. This is typically a blockchain address or process identifier that the monitor will track for nonce updates.

**Example Format:** `0x1234567890abcdef1234567890abcdef12345678` or similar process identifier

**How to Obtain:**
1. Identify the process/address you want to monitor
2. Copy the exact identifier from your application or blockchain explorer
3. Ensure the format matches what your monitoring endpoint expects

## Optional Secrets

### SLACK_WEBHOOK_URL

**Required:** No

**Description:** Slack incoming webhook URL for sending notifications when issues are detected. If not set, Slack notifications will be skipped.

**Example Format:** `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`

**How to Obtain:** See [SLACK_SETUP.md](../SLACK_SETUP.md) for detailed instructions on creating a Slack webhook.

### REQUEST_TIMEOUT

**Required:** No

**Description:** HTTP request timeout in seconds for API calls to the monitoring endpoint.

**Default Value:** `30` seconds

**When to Change:**
- Increase if monitoring endpoint is slow to respond
- Decrease for faster failure detection in time-sensitive environments
- Set between 10-120 seconds depending on network conditions

## Adding Secrets

### Using GitHub Web UI

1. Navigate to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name (e.g., `PROCESS_ID`)
5. Enter the secret value
6. Click **Add secret**
7. Repeat for each secret

### Using GitHub CLI

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Linux: See https://github.com/cli/cli#installation

# Authenticate
gh auth login

# Set secrets
gh secret set PROCESS_ID
# (paste value when prompted)

gh secret set SLACK_WEBHOOK_URL
# (paste webhook URL when prompted)

gh secret set REQUEST_TIMEOUT
# (enter timeout value when prompted)
```

### Using the Helper Script

A convenience script is provided in the repository root:

```bash
./setup-github-secrets.sh
```

This script will prompt you for each secret value and configure them automatically.

## Security Best Practices

### Never Commit Secrets

- Never commit secrets to the repository
- Do not store secrets in code, configuration files, or documentation
- Use `.gitignore` to exclude files containing sensitive data
- Review commits before pushing to ensure no secrets are included

### Rotate Periodically

- Change `SLACK_WEBHOOK_URL` if compromised
- Rotate secrets every 90 days as a general security practice
- Update secrets immediately if you suspect exposure

### Use Least Privilege

- Limit webhook permissions to only required channels
- Use read-only API tokens when possible
- Restrict repository access to necessary team members

## Testing Secrets

### Verify Secrets Are Set

Using GitHub CLI:

```bash
gh secret list
```

This will show all configured secrets (values are hidden).

### Test with Manual Workflow Run

1. Go to **Actions** tab in your repository
2. Select the **Monitor Nonce** workflow
3. Click **Run workflow** → **Run workflow**
4. Monitor the workflow execution to verify secrets are working
5. Check for any errors related to missing or invalid secrets

### Common Issues

**Error: "Required secret PROCESS_ID is not set"**
- Solution: Add the PROCESS_ID secret as described above

**Error: "HTTP request timeout"**
- Solution: Increase REQUEST_TIMEOUT secret value

**Slack notifications not received:**
- Verify SLACK_WEBHOOK_URL is correct
- Check Slack app configuration
- Ensure webhook is not disabled
- Review workflow logs for Slack API errors
