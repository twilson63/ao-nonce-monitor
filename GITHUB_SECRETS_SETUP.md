# GitHub Secrets Configuration Guide for SU Router Retry

## Quick Setup Instructions

### 1. Navigate to GitHub Secrets
1. Go to your GitHub repository
2. Click on **Settings** tab
3. Go to **Secrets and variables** → **Actions**
4. Click **New repository secret**

### 2. Add Retry Configuration Secrets

#### Option A: Use Defaults (Recommended)
No additional secrets needed - workflows will use default values:
- `SU_ROUTER_MAX_RETRIES=5`
- `SU_ROUTER_BASE_DELAY=1000` (1 second)
- `SU_ROUTER_MAX_DELAY=30000` (30 seconds)

#### Option B: Custom Configuration
Add these secrets with your preferred values:

**For High-Frequency Monitoring (≤1 minute):**
```
Name: SU_ROUTER_MAX_RETRIES
Value: 2

Name: SU_ROUTER_BASE_DELAY  
Value: 2000

Name: SU_ROUTER_MAX_DELAY
Value: 15000
```

**For Unreliable Networks:**
```
Name: SU_ROUTER_MAX_RETRIES
Value: 7

Name: SU_ROUTER_BASE_DELAY
Value: 3000

Name: SU_ROUTER_MAX_DELAY
Value: 45000
```

**For Conservative Approach:**
```
Name: SU_ROUTER_MAX_RETRIES
Value: 5

Name: SU_ROUTER_BASE_DELAY
Value: 1000

Name: SU_ROUTER_MAX_DELAY
Value: 30000
```

### 3. Verify Configuration

After adding secrets, you can verify they're working by:

1. **Manual Test Run:**
   - Go to Actions tab
   - Select any workflow (e.g., "AO Network Nonce Monitor (Multi-Process)")
   - Click "Run workflow"
   - Check the logs for retry activity

2. **Check Logs:**
   - Look for entries like: `[SU Router Retry] Attempt 1/5...`
   - If no retry entries, either the endpoint is healthy or retries are disabled

## Configuration Validation

### Test with Custom Values
```bash
# Test with different retry settings
SU_ROUTER_MAX_RETRIES=3 SU_ROUTER_BASE_DELAY=2000 node nonce-monitor.js
```

### Monitor Retry Activity
```bash
# View retry attempts in logs
grep "SU Router Retry" /var/log/nonce-monitor/monitor.log
```

## Troubleshooting

### Secrets Not Working
1. Ensure secret names match exactly (case-sensitive)
2. Check that secrets are saved properly
3. Verify workflow files were updated correctly

### Too Many Retries
- Reduce `SU_ROUTER_MAX_RETRIES` to 2-3 for faster failure detection
- Increase `SU_ROUTER_BASE_DELAY` for longer initial delays

### Still Getting Failures
- Check if errors are retryable (4xx errors won't retry)
- Verify network connectivity to SU Router endpoint
- Consider increasing timeout values

### Performance Issues
- Reduce `SU_ROUTER_MAX_DELAY` for shorter maximum retry time
- Lower `SU_ROUTER_MAX_RETRIES` to reduce total retry attempts

## Best Practices

1. **Start with defaults** - Monitor performance before customizing
2. **Use conservative values** - Better to retry too much than too little
3. **Monitor logs** - Check retry frequency to optimize settings
4. **Test changes** - Use manual workflow runs to validate configuration
5. **Document changes** - Keep track of what settings work best for your environment