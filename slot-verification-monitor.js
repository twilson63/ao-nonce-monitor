#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const pagerduty = require('./lib/pagerduty');

const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '15000', 10);
const SLOT_VERIFICATION_MODE = process.env.SLOT_VERIFICATION_MODE === 'true';
const CURRENT_SLOT = process.env.CURRENT_SLOT;
const SLOT_BOUNDARY = process.env.SLOT_BOUNDARY;

function getTimestamp() {
  return new Date().toISOString();
}

function truncateProcessId(processId) {
  if (processId.length <= 19) {
    return processId;
  }
  return `${processId.slice(0, 8)}...${processId.slice(-8)}`;
}

function isValidProcessId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

function isRetryableError(error) {
  if (!error || !error.message) {
    return false;
  }
  
  const errorMessage = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'network',
    'econnrefused',
    'etimedout',
    'enotfound',
    'http 5',
    'http 429',
    'aborterror',
    'fetch failed',
    'request timeout'
  ];
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern.toLowerCase()));
}

function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
  return Math.min(jitteredDelay, maxDelay);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logError(processId, message) {
  const timestamp = getTimestamp();
  const processStr = processId ? `[${truncateProcessId(processId)}]` : '[unknown]';
  console.error(`[${timestamp}] ${processStr} ERROR: ${message}`);
}

function logInfo(processId, message) {
  const timestamp = getTimestamp();
  const processStr = processId ? `[${truncateProcessId(processId)}]` : '[system]';
  console.log(`[${timestamp}] ${processStr} INFO: ${message}`);
}

function logResult(processId, stateNonce, suRouterNonce, gateway = 'unknown') {
  const timestamp = getTimestamp();
  const processStr = processId ? `[${truncateProcessId(processId)}]` : '[unknown]';
  const match = String(stateNonce) === String(suRouterNonce);
  const status = match ? '✓' : '✗';
  const diff = match ? '0' : Math.abs(parseInt(stateNonce) - parseInt(suRouterNonce));
  
  console.log(`[${timestamp}] ${processStr} ${status} [${gateway}] State: ${stateNonce}, SU Router: ${suRouterNonce}, Diff: ${diff}`);
}

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 3, baseDelay = 1000, maxDelay = 30000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);
      return response;
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      if (isRetryableError(error)) {
        const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
        console.log(`[${getTimestamp()}] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms for ${url}`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

async function fetchStateNonce(processId, gatewayUrl) {
  // Use the standard state endpoint format from the original monitor
  const url = `https://state.forward.computer/${processId}~process@1.0/compute/at-slot`;
  
  try {
    const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);
    const text = await response.text();
    const nonce = text.trim();
    
    if (!nonce) {
      throw new Error('State endpoint returned empty nonce');
    }
    
    if (!/^[0-9]+$/.test(nonce)) {
      throw new Error(`Invalid nonce format: ${nonce}`);
    }
    
    return nonce;
  } catch (error) {
    throw new Error(`State fetch failed: ${error.message}`);
  }
}

async function fetchSURouterNonce(processId) {
  const url = `https://su-router.ao-testnet.xyz/${processId}/latest`;
  
  try {
    const response = await fetchWithRetry(url, {}, 
      parseInt(process.env.SU_ROUTER_MAX_RETRIES || '5', 10),
      parseInt(process.env.SU_ROUTER_BASE_DELAY || '1000', 10),
      parseInt(process.env.SU_ROUTER_MAX_DELAY || '30000', 10)
    );
    
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON response structure');
    }
    
    // Extract nonce from assignment.tags
    if (data.assignment && data.assignment.tags) {
      const nonceTag = data.assignment.tags.find(tag => tag.name === 'Nonce');
      if (nonceTag && nonceTag.value && /^[0-9]+$/.test(nonceTag.value)) {
        return nonceTag.value;
      }
    }
    
    throw new Error(`Could not find valid nonce in assignment.tags`);
    
  } catch (error) {
    throw new Error(`SU Router fetch failed: ${error.message}`);
  }
}

function loadProcessMap() {
  try {
    const processMapContent = fs.readFileSync('process-map.json', 'utf8');
    return JSON.parse(processMapContent);
  } catch (error) {
    throw new Error(`Failed to load process-map.json: ${error.message}`);
  }
}

function loadConfig(configFile) {
  try {
    const content = fs.readFileSync(configFile, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .filter(isValidProcessId);
  } catch (error) {
    throw new Error(`Failed to load config file ${configFile}: ${error.message}`);
  }
}

async function checkProcess(processId, processMap) {
  const startTime = Date.now();
  
  try {
    // Get the appropriate gateway for this process
    const gatewayUrl = processMap[processId];
    if (!gatewayUrl) {
      throw new Error(`No gateway mapping found for process ${processId}`);
    }
    
    // Extract gateway name for logging
    const gatewayName = gatewayUrl.replace('https://', '').replace('.forward.computer', '');
    
    logInfo(processId, `Checking via ${gatewayName} gateway`);
    
    // Fetch nonces from both sources
    const [stateNonce, suRouterNonce] = await Promise.all([
      fetchStateNonce(processId, gatewayUrl),
      fetchSURouterNonce(processId)
    ]);
    
    const match = String(stateNonce) === String(suRouterNonce);
    const diff = Math.abs(parseInt(stateNonce) - parseInt(suRouterNonce));
    const duration = Date.now() - startTime;
    
    logResult(processId, stateNonce, suRouterNonce, gatewayName);
    
    return {
      processId,
      stateNonce,
      suRouterNonce,
      match,
      diff,
      gateway: gatewayUrl,
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(processId, error.message);
    
    return {
      processId,
      stateNonce: null,
      suRouterNonce: null,
      match: false,
      diff: null,
      gateway: null,
      duration,
      error: error.message
    };
  }
}

async function checkAllProcesses(processIds, processMap) {
  const results = [];
  
  logInfo(null, `Starting slot verification for ${processIds.length} processes`);
  
  if (SLOT_VERIFICATION_MODE && CURRENT_SLOT && SLOT_BOUNDARY) {
    logInfo(null, `Slot verification mode: Current slot ${CURRENT_SLOT}, Boundary ${SLOT_BOUNDARY}`);
  }
  
  // Process in batches to avoid overwhelming the gateways
  const batchSize = 10;
  let processedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processIds.length; i += batchSize) {
    const batch = processIds.slice(i, i + batchSize);
    logInfo(null, `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(processIds.length / batchSize)} (${batch.length} processes)`);
    
    // Process each process individually to avoid failing the entire batch on single error
    for (const processId of batch) {
      try {
        const result = await checkProcess(processId, processMap);
        results.push(result);
        processedCount++;
        
        if (result.error) {
          errorCount++;
        }
      } catch (error) {
        // Log the error but continue processing other processes
        logError(processId, `Critical error during processing: ${error.message}`);
        results.push({
          processId,
          stateNonce: null,
          suRouterNonce: null,
          match: false,
          diff: null,
          gateway: null,
          duration: 0,
          error: `Critical processing error: ${error.message}`
        });
        processedCount++;
        errorCount++;
      }
    }
    
    // Progress update
    logInfo(null, `Batch completed: ${processedCount}/${processIds.length} processed, ${errorCount} errors so far`);
    
    // Small delay between batches to be respectful to the gateways
    if (i + batchSize < processIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function generateSummary(results) {
  const total = results.length;
  const matches = results.filter(r => r.match && !r.error).length;
  const mismatches = results.filter(r => !r.match && !r.error).length;
  const errors = results.filter(r => r.error).length;
  
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
  
  console.log('\n=== SLOT VERIFICATION SUMMARY ===');
  console.log(`Total Processes: ${total}`);
  console.log(`Matches: ${matches} ✓`);
  console.log(`Mismatches: ${mismatches} ✗`);
  console.log(`Errors: ${errors} ⚠`);
  console.log(`Average Response Time: ${Math.round(avgDuration)}ms`);
  console.log(`Success Rate: ${((total - errors) / total * 100).toFixed(1)}%`);
  
  if (SLOT_VERIFICATION_MODE && CURRENT_SLOT && SLOT_BOUNDARY) {
    console.log(`Slot Context: Current ${CURRENT_SLOT}, Boundary ${SLOT_BOUNDARY}`);
  }
  
  // Add note about continue-on-error behavior
  if (errors > 0) {
    console.log('\nℹ️  Note: All processes were checked despite individual errors');
    console.log('   Review individual process logs above for specific error details');
  }
  
  // Gateway performance summary
  const gatewayStats = {};
  results.forEach(r => {
    if (r.gateway) {
      const gateway = r.gateway.replace('https://', '').replace('.forward.computer', '');
      if (!gatewayStats[gateway]) {
        gatewayStats[gateway] = { total: 0, errors: 0, avgDuration: 0 };
      }
      gatewayStats[gateway].total++;
      if (r.error) gatewayStats[gateway].errors++;
      gatewayStats[gateway].avgDuration += r.duration;
    }
  });
  
  console.log('\n=== GATEWAY PERFORMANCE ===');
  Object.entries(gatewayStats).forEach(([gateway, stats]) => {
    const successRate = ((stats.total - stats.errors) / stats.total * 100).toFixed(1);
    const avgTime = Math.round(stats.avgDuration / stats.total);
    console.log(`${gateway}: ${stats.total} requests, ${successRate}% success, ${avgTime}ms avg`);
  });
  
  // Return 0 (success) if we completed checking all processes, even with some errors
  // This allows the workflow to continue and generate reports
  // Only return 1 if there was a critical failure that prevented completion
  return 0;
}

async function sendSlackAlert(mismatches) {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl || mismatches.length === 0) {
    return;
  }
  
  const message = buildSlackMessage(mismatches);
  
  try {
    await postToSlack(slackWebhookUrl, message);
    console.log(`[${getTimestamp()}] Slack alert sent for ${mismatches.length} mismatches`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Failed to send Slack alert: ${error.message}`);
  }
}

function buildSlackMessage(mismatches) {
  const text = `🚨 AO Network Slot Mismatch Alert - ${mismatches.length} processes affected`;
  
  const attachments = mismatches.slice(0, 10).map(mismatch => ({
    color: mismatch.diff >= 100 ? 'danger' : mismatch.diff >= 50 ? 'warning' : 'good',
    fields: [
      { title: 'Process ID', value: truncateProcessId(mismatch.processId), short: true },
      { title: 'Gateway', value: mismatch.gateway ? mismatch.gateway.replace('https://', '').replace('.forward.computer', '') : 'unknown', short: true },
      { title: 'State Nonce', value: mismatch.stateNonce, short: true },
      { title: 'SU Router Nonce', value: mismatch.suRouterNonce, short: true },
      { title: 'Difference', value: `${mismatch.diff} slots`, short: true },
      { title: 'Timestamp', value: getTimestamp(), short: true }
    ]
  }));
  
  if (mismatches.length > 10) {
    attachments.push({
      color: 'good',
      text: `... and ${mismatches.length - 10} more mismatches`
    });
  }
  
  return {
    text,
    attachments,
    footer: 'AO Network Slot Verification Monitor',
    ts: Math.floor(Date.now() / 1000)
  };
}

function postToSlack(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const payload = JSON.stringify(message);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Slack request timeout'));
    });
    
    req.write(payload);
    req.end();
  });
}

async function main() {
  const configFile = process.env.CONFIG_FILE || './process-ids.txt';
  
  try {
    // Load process map for gateway routing
    const processMap = loadProcessMap();
    logInfo(null, `Loaded process map with ${Object.keys(processMap).length} process-gateway mappings`);
    
    let processIds;
    
    if (fs.existsSync(configFile)) {
      // Use provided config file
      processIds = loadConfig(configFile);
      logInfo(null, `Loaded ${processIds.length} process IDs from ${configFile}`);
    } else {
      // Use all processes from the process map
      processIds = Object.keys(processMap);
      logInfo(null, `Using all ${processIds.length} processes from process-map.json`);
    }
    
    // Verify all process IDs have gateway mappings
    const missingGateways = processIds.filter(id => !processMap[id]);
    if (missingGateways.length > 0) {
      logError(null, `Missing gateway mappings for ${missingGateways.length} processes`);
      missingGateways.forEach(id => logError(id, 'No gateway mapping found'));
    }
    
    // Filter to only processes with gateway mappings
    const validProcessIds = processIds.filter(id => processMap[id]);
    if (validProcessIds.length === 0) {
      throw new Error('No valid processes with gateway mappings found');
    }
    
    const results = await checkAllProcesses(validProcessIds, processMap);
    const exitCode = generateSummary(results);
    
    // Prepare alerts for significant mismatches
    const mismatches = results
      .filter(r => {
        if (r.error || r.match) return false;
        const diff = Math.abs(parseInt(r.stateNonce) - parseInt(r.suRouterNonce));
        return diff >= 25; // Lower threshold for slot verification
      })
      .map(r => ({
        processId: r.processId,
        stateNonce: r.stateNonce,
        suRouterNonce: r.suRouterNonce,
        diff: r.diff,
        gateway: r.gateway,
        timestamp: getTimestamp()
      }));
    
    const errors = results
      .filter(r => r.error)
      .map(r => ({
        processId: r.processId,
        error: r.error,
        timestamp: getTimestamp()
      }));
    
    await sendSlackAlert(mismatches);
    
    const pdConfig = pagerduty.getConfigFromEnv();
    if (pdConfig.enabled && mismatches.length > 0) {
      await pagerduty.sendPagerDutyEvent(mismatches, 'trigger', pdConfig);
    }
    if (pdConfig.enabled && errors.length > 0) {
      await pagerduty.sendPagerDutyEvent(errors, 'trigger', pdConfig);
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    logError(null, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    logError(null, `Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  loadProcessMap,
  checkProcess,
  checkAllProcesses,
  generateSummary
};