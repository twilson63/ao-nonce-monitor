# GitHub Workflows SU Router Retry Configuration - Summary

## Changes Made

All GitHub workflow files have been updated to include SU Router retry configuration with the following environment variables:

### Added Environment Variables
- `SU_ROUTER_MAX_RETRIES: ${{ secrets.SU_ROUTER_MAX_RETRIES || '5' }}`
- `SU_ROUTER_BASE_DELAY: ${{ secrets.SU_ROUTER_BASE_DELAY || '1000' }}`
- `SU_ROUTER_MAX_DELAY: ${{ secrets.SU_ROUTER_MAX_DELAY || '30000' }}`

## Updated Workflow Files

### 1. `nonce-monitor-multi.yml`
- **Purpose**: Multi-process monitoring
- **Schedule**: Every 5 minutes
- **Config**: Uses `process-ids.txt`
- **Status**: ✅ Updated with retry configuration

### 2. `nonce-monitor-push5.yml`
- **Purpose**: Push 5 specific monitoring
- **Schedule**: Every 5 minutes
- **Config**: Uses `process-ids.push-5.txt`
- **Status**: ✅ Updated with retry configuration

### 3. `nonce-monitor-state1.yml`
- **Purpose**: State 1 specific monitoring
- **Schedule**: Every 5 minutes
- **Config**: Uses `process-ids.txt`
- **Status**: ✅ Updated with retry configuration

### 4. `nonce-monitor-state2.yml`
- **Purpose**: State 2 specific monitoring
- **Schedule**: Every 5 minutes
- **Config**: Uses `process-ids.state-2.txt`
- **Status**: ✅ Updated with retry configuration

## Configuration Options

### GitHub Secrets Configuration
To customize retry behavior for specific workflows, add these secrets to your GitHub repository:

1. `SU_ROUTER_MAX_RETRIES` - Number of retry attempts (default: 5)
2. `SU_ROUTER_BASE_DELAY` - Initial retry delay in milliseconds (default: 1000)
3. `SU_ROUTER_MAX_DELAY` - Maximum retry delay in milliseconds (default: 30000)

### Recommended Configurations

#### For High-Frequency Monitoring (≤1 minute intervals)
```
SU_ROUTER_MAX_RETRIES=2
SU_ROUTER_BASE_DELAY=2000
SU_ROUTER_MAX_DELAY=15000
```

#### For Unreliable Network Environments
```
SU_ROUTER_MAX_RETRIES=7
SU_ROUTER_BASE_DELAY=3000
SU_ROUTER_MAX_DELAY=45000
```

#### For Conservative Approach (Default)
```
SU_ROUTER_MAX_RETRIES=5
SU_ROUTER_BASE_DELAY=1000
SU_ROUTER_MAX_DELAY=30000
```

## Benefits in GitHub Actions

1. **Improved Reliability**: Reduces false positives due to transient network issues
2. **Configurable Resilience**: Each workflow can have custom retry settings
3. **Better Observability**: Retry attempts logged in GitHub Actions logs
4. **Zero Maintenance**: Automatic retry with exponential backoff
5. **Cost Effective**: Reduces failed workflow runs due to temporary issues

## Monitoring Retry Activity

To monitor retry activity in GitHub Actions:

1. Go to the Actions tab in your repository
2. Select a workflow run
3. Look for log entries containing `[SU Router Retry]`
4. Example log entry:
   ```
   [2024-01-15T10:30:00.000Z] [SU Router Retry] Attempt 1/5 for https://su-router.ao-testnet.xyz/... after 1200ms delay: Request timeout after 10000ms
   ```

## Backward Compatibility

- All workflows maintain backward compatibility
- Default values used when secrets are not set
- No breaking changes to existing workflow configurations
- Existing GitHub secrets continue to work unchanged