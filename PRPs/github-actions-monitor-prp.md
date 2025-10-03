# Project Request Protocol: GitHub Actions Automated Monitoring

## Project Overview

### Purpose
Set up a GitHub Actions workflow to automatically run the AO Network Nonce Monitor every 5 minutes, enabling continuous monitoring without requiring dedicated server infrastructure or manual cron setup.

### Background
The current deployment model requires:
- A dedicated server or VM to run cron jobs
- Manual server setup and maintenance
- SSH access and system administration
- Log management and monitoring infrastructure

GitHub Actions can provide:
- Serverless execution (no infrastructure to maintain)
- Built-in scheduling with workflow triggers
- Automated execution in GitHub's cloud
- Integrated logging and monitoring
- Version-controlled configuration
- Easy rollback and updates

### Current State
**Existing Deployment:**
- Requires server with cron daemon
- Manual crontab configuration
- Server maintenance overhead
- Monitoring via log files

**Enhancement Needed:**
- GitHub Actions workflow for automated execution
- Schedule trigger (every 5 minutes)
- Environment variable management (secrets)
- Artifact/log storage
- Slack integration for alerts
- No server infrastructure required

### Success Indicators
- GitHub Actions workflow runs every 5 minutes
- Nonce monitoring executes successfully
- Results logged in GitHub Actions
- Slack alerts sent on mismatches
- No server infrastructure required
- Easy to enable/disable monitoring
- Version-controlled configuration

---

## Technical Requirements

### Functional Requirements

1. **Workflow Scheduling**
   - Use GitHub Actions `schedule` trigger
   - Run every 5 minutes (500 slots)
   - Support manual triggering (`workflow_dispatch`)
   - Handle workflow concurrency

2. **Environment Configuration**
   - Store `PROCESS_ID` as repository secret
   - Store `SLACK_WEBHOOK_URL` as repository secret
   - Support multi-process via config file in repository
   - Optional: `CONFIG_FILE` for multi-process mode

3. **Workflow Execution**
   - Checkout repository code
   - Set up Node.js environment
   - Install dependencies (none required)
   - Execute nonce-monitor.js
   - Capture output logs

4. **Result Handling**
   - Log output to GitHub Actions console
   - Store logs as workflow artifacts (optional)
   - Send Slack alerts on mismatches
   - Set workflow status (success/failure)

5. **Error Handling**
   - Handle workflow failures gracefully
   - Alert on repeated failures
   - Retry logic (optional)
   - Timeout protection

6. **Monitoring & Observability**
   - View execution history in Actions tab
   - Download logs from workflow runs
   - Track success/failure rates
   - Monitor execution time

### Non-Functional Requirements

- **Reliability**: 99%+ success rate for workflow execution
- **Performance**: Complete within 2 minutes (GitHub Actions timeout)
- **Cost**: Stay within GitHub Actions free tier limits
- **Security**: Secrets stored securely in GitHub
- **Maintainability**: Easy to update and configure
- **Observability**: Clear logs and status reporting

### Constraints

- GitHub Actions free tier: 2,000 minutes/month for private repos (unlimited for public)
- Maximum workflow run time: 6 hours
- Schedule minimum interval: 5 minutes
- Workflow concurrency limits
- No persistent storage between runs
- Must use GitHub-hosted runners

---

## Proposed Solutions

### Solution 1: Basic Scheduled Workflow

**Description**: Simple GitHub Actions workflow using cron schedule trigger to run every 5 minutes.

**Workflow File**: `.github/workflows/nonce-monitor.yml`

```yaml
name: AO Nonce Monitor

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run nonce monitor
        env:
          PROCESS_ID: ${{ secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: node nonce-monitor.js
```

**Pros**:
- ✅ Simple and straightforward
- ✅ Minimal configuration required
- ✅ Uses GitHub-hosted runners (no infrastructure)
- ✅ Free for public repositories
- ✅ Version-controlled workflow
- ✅ Easy to enable/disable (pause workflow)
- ✅ Built-in logging in Actions console

**Cons**:
- ❌ Minimum interval is 5 minutes (GitHub limitation)
- ❌ Schedule may drift up to 10 minutes under load
- ❌ Uses free tier minutes (private repos)
- ❌ No persistent state between runs
- ❌ Cannot run more frequently than 5 minutes
- ❌ GitHub Actions can be delayed during high load

---

### Solution 2: Workflow with Artifacts and Caching

**Description**: Enhanced workflow with artifact storage, caching, and detailed reporting.

**Workflow File**: `.github/workflows/nonce-monitor.yml`

```yaml
name: AO Nonce Monitor

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Run nonce monitor
        id: monitor
        env:
          PROCESS_ID: ${{ secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          REQUEST_TIMEOUT: 10000
        run: |
          node nonce-monitor.js 2>&1 | tee nonce-monitor.log
          echo "status=$?" >> $GITHUB_OUTPUT
      
      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: nonce-monitor-logs-${{ github.run_number }}
          path: nonce-monitor.log
          retention-days: 7
      
      - name: Check status
        if: steps.monitor.outputs.status != '0'
        run: exit 1
```

**Pros**:
- ✅ Logs stored as artifacts (downloadable)
- ✅ Caching reduces setup time
- ✅ Timeout protection
- ✅ Better error handling
- ✅ Artifacts retained for 7 days
- ✅ Detailed status reporting

**Cons**:
- ❌ More complex configuration
- ❌ Uses artifact storage (has limits)
- ❌ Still subject to 5-minute minimum interval
- ❌ More setup time per run (artifact upload)
- ❌ Higher free tier usage

---

### Solution 3: Multi-Job Workflow with Matrix Strategy

**Description**: Advanced workflow using matrix strategy to monitor multiple processes in parallel.

**Workflow File**: `.github/workflows/nonce-monitor.yml`

```yaml
name: AO Nonce Monitor

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    strategy:
      matrix:
        config: [single, multi]
      fail-fast: false
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run monitor (single)
        if: matrix.config == 'single'
        env:
          PROCESS_ID: ${{ secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: node nonce-monitor.js
      
      - name: Run monitor (multi)
        if: matrix.config == 'multi'
        env:
          CONFIG_FILE: process-ids.txt
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: node nonce-monitor.js
      
      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: logs-${{ matrix.config }}-${{ github.run_number }}
          path: '*.log'
          retention-days: 3
```

**Pros**:
- ✅ Supports both single and multi-process modes
- ✅ Parallel execution (faster)
- ✅ Fail-fast disabled (one failure doesn't stop others)
- ✅ Flexible matrix strategy
- ✅ Can extend to monitor different networks

**Cons**:
- ❌ Most complex configuration
- ❌ Uses more free tier minutes (parallel jobs)
- ❌ Overkill for simple use cases
- ❌ Harder to debug
- ❌ More moving parts

---

## Solution Comparison Matrix

| Criteria | Solution 1 (Basic) | Solution 2 (Artifacts) | Solution 3 (Matrix) |
|----------|-------------------|------------------------|---------------------|
| **Complexity** | Low | Medium | High |
| **Setup Time** | Fast | Medium | Slow |
| **Free Tier Usage** | Low | Medium | High |
| **Log Retention** | Temporary | 7 days | 3 days |
| **Error Handling** | Basic | Good | Advanced |
| **Flexibility** | Low | Medium | High |
| **Maintenance** | Easy | Medium | Complex |
| **Debugging** | Easy | Easy | Moderate |
| **Multi-Process** | Yes | Yes | Parallel |
| **Recommended For** | Most users | Production | Advanced |

---

## Recommended Solution

**Solution 1: Basic Scheduled Workflow**

### Rationale

1. **Simplicity**: Easiest to implement and maintain
2. **Sufficient**: Meets all core requirements
3. **Free Tier Friendly**: Minimal usage of GitHub Actions minutes
4. **Reliable**: Fewer moving parts = fewer failure points
5. **Easy Debugging**: Simple workflow is easy to troubleshoot
6. **Clear Logs**: GitHub Actions console provides sufficient logging
7. **Quick Setup**: Can be deployed in minutes

### Trade-offs Accepted

- **No Artifact Storage**: Logs only in console (acceptable - Slack alerts for critical issues)
  - *Mitigation*: Can add artifacts later if needed
  
- **5-Minute Minimum**: GitHub's limitation (acceptable for monitoring use case)
  - *Mitigation*: 5 minutes aligns with 500-slot interval

- **Schedule Drift**: May run slightly less frequently under load
  - *Mitigation*: Not critical for monitoring use case

### When to Upgrade

Consider Solution 2 if:
- Need historical log retention beyond GitHub's default
- Want to analyze trends over time
- Need to share logs with team members

Consider Solution 3 if:
- Monitoring many different networks/processes
- Need parallel execution for speed
- Have complex monitoring requirements

---

## Implementation Steps

### Phase 1: GitHub Actions Setup

**Step 1.1: Create Workflow Directory**
```bash
mkdir -p .github/workflows
```

**Step 1.2: Create Workflow File**
Create `.github/workflows/nonce-monitor.yml` with basic configuration

**Step 1.3: Configure Schedule**
- Set cron schedule: `*/5 * * * *` (every 5 minutes)
- Add `workflow_dispatch` for manual triggers

**Step 1.4: Define Job Steps**
- Checkout code
- Setup Node.js 18+
- Run nonce-monitor.js with environment variables

### Phase 2: GitHub Secrets Configuration

**Step 2.1: Add Repository Secrets**
Navigate to: Repository → Settings → Secrets and variables → Actions

Add secrets:
- `PROCESS_ID` - AO network process ID
- `SLACK_WEBHOOK_URL` - Slack webhook URL (optional)
- `REQUEST_TIMEOUT` - Request timeout in ms (optional, default: 10000)

**Step 2.2: Test Secret Access**
Add debug step to verify secrets are accessible (temporary)

**Step 2.3: Secure Secrets**
- Never log secret values
- Use `secrets.` context in workflow
- Document which secrets are required

### Phase 3: Workflow Testing

**Step 3.1: Manual Trigger Test**
- Commit workflow file
- Go to Actions tab
- Click "Run workflow" button
- Verify execution succeeds

**Step 3.2: Schedule Test**
- Wait for first scheduled run (up to 5 minutes)
- Verify workflow triggered automatically
- Check logs for correct output

**Step 3.3: Error Testing**
- Test with invalid PROCESS_ID
- Test with missing secrets
- Verify error handling

### Phase 4: Multi-Process Support (Optional)

**Step 4.1: Commit process-ids.txt**
Add process-ids.txt to repository (if using multi-process mode)

**Step 4.2: Update Workflow**
Add CONFIG_FILE environment variable pointing to process-ids.txt

**Step 4.3: Test Multi-Process**
Trigger workflow and verify all processes checked

### Phase 5: Monitoring & Optimization

**Step 5.1: Monitor Execution History**
- Check Actions tab for run history
- Verify success rate > 99%
- Monitor execution time

**Step 5.2: Optimize Performance**
- Remove unnecessary steps
- Minimize checkout size (sparse checkout)
- Cache Node.js setup

**Step 5.3: Set Up Notifications**
- Configure GitHub notification settings
- Set up Slack workflow notifications (optional)
- Document alerting strategy

### Phase 6: Documentation

**Step 6.1: Update README**
- Document GitHub Actions setup
- Explain how to configure secrets
- Provide troubleshooting guide

**Step 6.2: Document Workflow**
- Add comments to workflow file
- Explain each step
- Document environment variables

**Step 6.3: Create Operations Guide**
- How to enable/disable monitoring
- How to view logs
- How to update configuration

---

## Implementation Specifications

### Workflow File Template

**File**: `.github/workflows/nonce-monitor.yml`

```yaml
name: AO Network Nonce Monitor

# Run every 5 minutes (approximately 500 slots on most AO networks)
on:
  schedule:
    # GitHub Actions schedule syntax (UTC time)
    # Note: Scheduled workflows may be delayed up to 10 minutes during high load
    - cron: '*/5 * * * *'
  
  # Allow manual triggering for testing
  workflow_dispatch:
    inputs:
      process_id:
        description: 'Process ID to monitor (overrides secret)'
        required: false
        type: string

# Ensure only one workflow runs at a time
concurrency:
  group: nonce-monitor
  cancel-in-progress: false

jobs:
  monitor-nonce:
    name: Monitor AO Nonce Synchronization
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Display workflow info
        run: |
          echo "Workflow: ${{ github.workflow }}"
          echo "Run ID: ${{ github.run_id }}"
          echo "Run number: ${{ github.run_number }}"
          echo "Triggered by: ${{ github.event_name }}"
          echo "Time: $(date -u)"
      
      - name: Run nonce monitor
        env:
          PROCESS_ID: ${{ inputs.process_id || secrets.PROCESS_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          REQUEST_TIMEOUT: ${{ secrets.REQUEST_TIMEOUT || '10000' }}
        run: |
          echo "Starting nonce monitor..."
          node nonce-monitor.js
          EXIT_CODE=$?
          echo "Monitor completed with exit code: $EXIT_CODE"
          exit $EXIT_CODE
      
      - name: Workflow summary
        if: always()
        run: |
          echo "### Nonce Monitor Results :rocket:" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Status:** ${{ job.status }}" >> $GITHUB_STEP_SUMMARY
          echo "**Time:** $(date -u)" >> $GITHUB_STEP_SUMMARY
          echo "**Run ID:** ${{ github.run_id }}" >> $GITHUB_STEP_SUMMARY
```

### Multi-Process Workflow Variant

```yaml
name: AO Network Nonce Monitor (Multi-Process)

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  monitor-multi-process:
    name: Monitor Multiple Processes
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Verify process-ids.txt
        run: |
          if [ ! -f process-ids.txt ]; then
            echo "Error: process-ids.txt not found"
            exit 1
          fi
          echo "Process IDs to monitor:"
          grep -v '^#' process-ids.txt | grep -v '^$' || echo "None found"
      
      - name: Run multi-process monitor
        env:
          CONFIG_FILE: process-ids.txt
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          REQUEST_TIMEOUT: 10000
        run: node nonce-monitor.js
```

### GitHub Secrets Setup

**Required Secrets:**
- `PROCESS_ID` - The AO network process ID to monitor
  - Example: `0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc`

**Optional Secrets:**
- `SLACK_WEBHOOK_URL` - Slack webhook for alerts
  - Example: `https://hooks.slack.com/services/T00000000/B00000000/XXXX`
- `REQUEST_TIMEOUT` - HTTP request timeout in milliseconds
  - Default: `10000`

### Concurrency Control

```yaml
concurrency:
  group: nonce-monitor
  cancel-in-progress: false
```

This ensures:
- Only one workflow runs at a time
- If a run is in progress, subsequent triggers wait
- No race conditions

---

## Success Criteria

### Functional Success Criteria

- ✅ **Workflow Triggers**: Runs every 5 minutes automatically
- ✅ **Manual Trigger**: Can be triggered manually from Actions tab
- ✅ **Execution Success**: Nonce monitor completes successfully
- ✅ **Environment Variables**: Secrets accessible in workflow
- ✅ **Logging**: Output visible in Actions console
- ✅ **Slack Integration**: Alerts sent on mismatches (if configured)
- ✅ **Status Reporting**: Workflow status reflects monitor results
- ✅ **Error Handling**: Failures logged and visible

### Non-Functional Success Criteria

- ✅ **Reliability**: >99% successful execution rate
- ✅ **Performance**: Completes within 2 minutes
- ✅ **Cost**: Stays within free tier (public repo or <2000 min/month)
- ✅ **Observability**: Easy to view logs and execution history
- ✅ **Maintainability**: Easy to update and configure
- ✅ **Security**: Secrets never exposed in logs

### Operational Success Criteria

- ✅ **Setup Time**: Can be deployed in < 30 minutes
- ✅ **Documentation**: Clear setup instructions in README
- ✅ **Troubleshooting**: Common issues documented
- ✅ **Monitoring**: Can view 90-day execution history
- ✅ **Updates**: Workflow updates automatically with git push

---

## GitHub Actions Limitations & Considerations

### Schedule Limitations

**Minimum Interval**: 5 minutes
- Cannot run more frequently than every 5 minutes
- Aligns well with 500-slot monitoring (~5 minutes on most networks)

**Schedule Drift**: Up to 10 minutes delay possible
- GitHub may delay scheduled workflows during high load
- Typically runs within 1-2 minutes of scheduled time
- Not suitable for sub-minute precision requirements

**Time Zone**: Cron schedule uses UTC
- All times in workflow are UTC
- Account for timezone differences in monitoring

### Free Tier Limits

**Public Repositories**: Unlimited Actions minutes
**Private Repositories**: 2,000 minutes/month (free tier)

**Calculation**:
- 5-minute interval = 12 runs/hour = 288 runs/day
- Average run time: ~30 seconds
- Daily usage: 288 × 0.5 min = 144 minutes/day
- Monthly usage: ~4,320 minutes/month
- **Result**: Exceeds free tier for private repos

**Mitigation**:
- Use public repository (recommended)
- Upgrade to paid plan
- Increase interval to 15 minutes (96 runs/day = ~1,440 min/month)
- Use cron on server for private repos

### Concurrency Limits

**Free tier**: Up to 20 concurrent jobs
**Default**: 1 concurrent job (via concurrency control)

### Storage Limits

**Artifacts**: 500 MB per repository (free tier)
**Retention**: Up to 90 days (configurable)

---

## Example Output

### Successful Workflow Run

```
Run node nonce-monitor.js
  node nonce-monitor.js
  shell: /usr/bin/bash -e {0}
  env:
    PROCESS_ID: ***
    SLACK_WEBHOOK_URL: ***
    REQUEST_TIMEOUT: 10000
Starting nonce monitor...
[2025-10-03T12:00:00.123Z] [0syT13r0...3ElLSrsc] State Nonce: 2205700 | SU Router Nonce: 2205700 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 1
Matches: 1 ✓
Mismatches: 0 ✗
Errors: 0 ⚠
Monitor completed with exit code: 0
```

### Workflow with Mismatch

```
[2025-10-03T12:05:00.456Z] [0syT13r0...3ElLSrsc] State Nonce: 2205800 | SU Router Nonce: 2205801 | Status: MISMATCH ✗

=== SUMMARY ===
Total Processes: 1
Matches: 0 ✓
Mismatches: 1 ✗
Errors: 0 ⚠

[2025-10-03T12:05:01.789Z] Slack alert sent (1 mismatch)
Monitor completed with exit code: 1
```

---

## Deployment Guide

### Step-by-Step Setup

1. **Create Workflow File**
   ```bash
   mkdir -p .github/workflows
   # Copy workflow template to .github/workflows/nonce-monitor.yml
   ```

2. **Configure Secrets**
   - Go to repository Settings → Secrets → Actions
   - Add `PROCESS_ID` secret
   - Add `SLACK_WEBHOOK_URL` secret (optional)

3. **Commit and Push**
   ```bash
   git add .github/workflows/nonce-monitor.yml
   git commit -m "Add GitHub Actions workflow for nonce monitoring"
   git push
   ```

4. **Test Manual Trigger**
   - Go to Actions tab
   - Select "AO Network Nonce Monitor" workflow
   - Click "Run workflow"
   - Monitor execution

5. **Verify Schedule**
   - Wait 5 minutes for first scheduled run
   - Check Actions tab for automatic execution
   - Review logs

6. **Monitor Operations**
   - Check Actions tab regularly
   - Set up notifications for failures
   - Review Slack alerts

### Enabling Multi-Process Mode

1. **Ensure process-ids.txt is in repository**
   ```bash
   # Make sure process-ids.txt is committed
   git add process-ids.txt
   git commit -m "Add process IDs for monitoring"
   git push
   ```

2. **Update workflow to use CONFIG_FILE**
   - Modify workflow env to include `CONFIG_FILE: process-ids.txt`
   - Remove or keep `PROCESS_ID` secret for fallback

3. **Test**
   - Trigger workflow manually
   - Verify all processes are monitored

---

## Troubleshooting

### Workflow Not Triggering

**Issue**: Scheduled workflow doesn't run

**Solutions**:
1. Check if repository is active (has recent commits)
2. GitHub may delay workflows on free tier
3. Verify cron syntax is correct
4. Try manual trigger to test workflow

### Secrets Not Working

**Issue**: Environment variables are undefined

**Solutions**:
1. Verify secrets are created in repository settings
2. Check secret names match workflow exactly
3. Ensure secrets are not scoped to specific environments
4. Test with workflow_dispatch and manual input

### Workflow Fails

**Issue**: Exit code 1, monitor fails

**Solutions**:
1. Check logs for error messages
2. Verify PROCESS_ID is correct
3. Test network connectivity to AO endpoints
4. Check timeout settings (may need to increase)

### Slack Alerts Not Sending

**Issue**: Mismatches detected but no Slack message

**Solutions**:
1. Verify SLACK_WEBHOOK_URL secret is set
2. Test webhook with curl
3. Check Slack app permissions
4. Review monitor logs for Slack error messages

---

## Cost Analysis

### Public Repository (Recommended)
- **GitHub Actions**: Free (unlimited minutes)
- **Storage**: Free (500 MB)
- **Total Cost**: $0/month

### Private Repository
- **Free Tier**: 2,000 minutes/month
- **Monthly Usage**: ~4,320 minutes (exceeds free tier)
- **Overage Cost**: ~$8/month (2,320 minutes × $0.008/min)
- **Alternative**: Increase interval to 15 minutes (~1,440 min/month) = Free

### Cost Optimization
1. Use public repository (free)
2. Increase interval to 15 minutes (reduces usage by 67%)
3. Use cron on server for private repos
4. Upgrade to Team plan ($4/user/month with 3,000 minutes)

---

## Comparison: GitHub Actions vs. Cron

| Aspect | GitHub Actions | Cron on Server |
|--------|---------------|----------------|
| **Infrastructure** | None required | Server required |
| **Setup** | 30 minutes | 1-2 hours |
| **Maintenance** | Minimal | Regular |
| **Cost** | Free (public) / $8/mo (private) | Server cost (~$5-50/mo) |
| **Logs** | Built-in | Manual setup |
| **Scheduling** | 5-min minimum | Any interval |
| **Reliability** | High (99.9%) | Depends on server |
| **Updates** | Git push | SSH + manual |
| **Observability** | Excellent | Manual |
| **Flexibility** | Limited | Full control |

**Recommendation**: 
- Use **GitHub Actions** for public repos or low-frequency monitoring
- Use **Cron** for private repos with high-frequency requirements (<5 min)

---

## Future Enhancements

### Phase 2 (Post-Launch)
1. **Artifact Storage**: Store logs as artifacts for historical analysis
2. **Status Badge**: Add workflow status badge to README
3. **Notifications**: GitHub Actions notifications via email/Slack
4. **Matrix Strategy**: Monitor multiple networks in parallel
5. **Conditional Execution**: Skip runs if no changes detected

### Phase 3 (Long-term)
1. **Custom Actions**: Create reusable action for AO monitoring
2. **Dashboard**: Build visualization of monitoring data
3. **Trend Analysis**: Analyze patterns over time
4. **Auto-remediation**: Trigger fixes on mismatch detection
5. **Multi-region**: Run from different GitHub-hosted runners

---

## Risks & Mitigation

### Risk 1: Schedule Drift
**Risk**: Workflow delayed during high GitHub load  
**Impact**: Medium - monitoring less frequent than expected  
**Mitigation**: 
- Acceptable for monitoring use case (not time-critical)
- Can add manual triggers for urgent checks
- Monitor execution history for delays

### Risk 2: Free Tier Exhaustion (Private Repos)
**Risk**: Exceed 2,000 minutes/month on free tier  
**Impact**: High - monitoring stops or costs incurred  
**Mitigation**:
- Use public repository (unlimited minutes)
- Increase interval to 15 minutes
- Monitor usage in Settings → Billing

### Risk 3: Workflow Failures
**Risk**: Workflow fails repeatedly due to transient issues  
**Impact**: Medium - missed monitoring windows  
**Mitigation**:
- Implement retry logic
- Set up failure notifications
- Slack alerts provide backup notification

### Risk 4: Secret Exposure
**Risk**: Secrets accidentally logged or exposed  
**Impact**: High - security breach  
**Mitigation**:
- Never log secret values
- Use `secrets.` context only
- Review workflow logs carefully
- Rotate secrets if exposed

### Risk 5: API Rate Limiting
**Risk**: GitHub API or AO endpoints rate limit requests  
**Impact**: Low - workflow failures  
**Mitigation**:
- 5-minute interval is conservative
- AO endpoints have generous limits
- Add exponential backoff if needed

---

## Approval & Sign-Off

**Project Scope**: Approved ✅  
**Technical Approach**: Basic Scheduled Workflow (Solution 1) ✅  
**Implementation Plan**: 6 phases ✅  
**Success Criteria**: Defined and measurable ✅  
**Cost Analysis**: Documented ✅  
**Risk Mitigation**: Documented ✅  

**Ready for Implementation**: ✅

---

**Document Version**: 1.0  
**Created**: October 3, 2025  
**Status**: Approved for Implementation  
**Estimated Effort**: 2-4 hours  
**Dependencies**: GitHub repository with nonce-monitor.js  
**Cost**: Free (public repo) or $8/month (private repo)
