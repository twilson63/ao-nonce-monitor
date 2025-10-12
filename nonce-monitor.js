#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const pagerduty = require('./lib/pagerduty');

const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);

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

function loadConfig(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const processIds = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '' || line.startsWith('#')) {
        continue;
      }
      
      if (isValidProcessId(line)) {
        processIds.push(line);
      } else {
        console.warn(`[${getTimestamp()}] WARNING: Invalid process ID on line ${i + 1}: "${line}"`);
      }
    }
    
    if (processIds.length === 0) {
      throw new Error('No valid process IDs found in config file');
    }
    
    return processIds;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${filePath}`);
    }
    throw error;
  }
}

function logError(processId, message) {
  if (processId) {
    console.error(`[${getTimestamp()}] [${truncateProcessId(processId)}] ERROR: ${message}`);
  } else {
    console.error(`[${getTimestamp()}] ERROR: ${message}`);
  }
}

function logResult(processId, stateNonce, suRouterNonce) {
  const match = String(stateNonce) === String(suRouterNonce);
  const status = match ? 'MATCH ✓' : 'MISMATCH ✗';
  
  if (processId) {
    console.log(`[${getTimestamp()}] [${truncateProcessId(processId)}] State Nonce: ${stateNonce} | SU Router Nonce: ${suRouterNonce} | Status: ${status}`);
  } else {
    console.log(`[${getTimestamp()}] State Nonce: ${stateNonce} | SU Router Nonce: ${suRouterNonce} | Status: ${status}`);
  }
}

async function sendSlackAlert(mismatches) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl || mismatches.length === 0) {
    return;
  }
  
  try {
    const message = buildSlackMessage(mismatches);
    await postToSlack(webhookUrl, message);
    console.log(`[${getTimestamp()}] Slack alert sent (${mismatches.length} mismatch(es))`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Failed to send Slack alert: ${error.message}`);
  }
}

async function sendSlackErrorAlert(errors) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl || errors.length === 0) {
    return;
  }
  
  try {
    const message = buildSlackErrorMessage(errors);
    await postToSlack(webhookUrl, message);
    console.log(`[${getTimestamp()}] Slack error alert sent (${errors.length} error(s))`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Failed to send Slack error alert: ${error.message}`);
  }
}

async function sendConsolidatedSlackAlert(mismatches, errors, options = {}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const totalIssues = (mismatches?.length || 0) + (errors?.length || 0);
  
  if (!webhookUrl || totalIssues === 0) {
    return;
  }
  
  try {
    const message = buildConsolidatedSlackMessage(mismatches || [], errors || [], options);
    await postToSlack(webhookUrl, message);
    console.log(`[${getTimestamp()}] Consolidated Slack alert sent for ${totalIssues} total issues`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Failed to send consolidated Slack alert: ${error.message}`);
  }
}

function buildSlackMessage(mismatches) {
  const count = mismatches.length;
  const text = count === 1 ? '🚨 Process Behind Scheduler' : `🚨 ${count} Processes Behind Scheduler`;
  const stateUrl = process.env.STATE_URL || 'https://state.forward.computer';
  
  if (count > 10) {
    const compactList = mismatches.slice(0, 10).map(m => {
      const diff = Math.abs(parseInt(m.stateNonce) - parseInt(m.suRouterNonce));
      return `• ${stateUrl} is behind ${diff} slots to the scheduler unit for process: ${truncateProcessId(m.processId)}`;
    }).join('\n');
    const remaining = count - 10;
    
    return {
      text: `${text}\n\n${compactList}\n\n... (${remaining} more)`,
      footer: 'AO Network Nonce Monitor',
      ts: Math.floor(Date.now() / 1000)
    };
  }
  
  const attachments = mismatches.map(mismatch => {
    const diff = Math.abs(parseInt(mismatch.stateNonce) - parseInt(mismatch.suRouterNonce));
    return {
      color: 'danger',
      fields: [
        { title: 'Process ID', value: truncateProcessId(mismatch.processId), short: true },
        { title: `${stateUrl} Slot`, value: String(mismatch.stateNonce), short: true },
        { title: 'https://su-router.ao-testnet.xyz Slot', value: String(mismatch.suRouterNonce), short: true },
        { title: 'Slots Behind', value: String(diff), short: true },
        { title: 'Timestamp', value: mismatch.timestamp, short: false }
      ]
    };
  });
  
  return {
    text,
    attachments,
    footer: 'AO Network Nonce Monitor',
    ts: Math.floor(Date.now() / 1000)
  };
}

function buildSlackErrorMessage(errors) {
  const count = errors.length;
  const text = count === 1 ? '⚠️ Process Check Error' : `⚠️ ${count} Process Check Errors`;
  
  if (count > 10) {
    const compactList = errors.slice(0, 10).map(e => 
      `• [${truncateProcessId(e.processId)}]: ${e.error}`
    ).join('\n');
    const remaining = count - 10;
    
    return {
      text: `${text}\n\n${compactList}\n\n... (${remaining} more)`,
      footer: 'AO Network Nonce Monitor',
      ts: Math.floor(Date.now() / 1000)
    };
  }
  
  const attachments = errors.map(err => ({
    color: 'warning',
    fields: [
      { title: 'Process ID', value: truncateProcessId(err.processId), short: true },
      { title: 'Error', value: err.error, short: false },
      { title: 'Timestamp', value: err.timestamp, short: true }
    ]
  }));
  
  return {
    text,
    attachments,
    footer: 'AO Network Nonce Monitor',
    ts: Math.floor(Date.now() / 1000)
  };
}

function buildConsolidatedSlackMessage(mismatches, errors, options = {}) {
  const totalMismatches = mismatches.length;
  const totalErrors = errors.length;
  const totalIssues = totalMismatches + totalErrors;
  
  let text = '🚨 AO Network Process Status Alert';
  if (options.context) {
    text += ` - ${options.context}`;
  }
  
  // Build summary line
  const summaryParts = [];
  if (totalMismatches > 0) {
    summaryParts.push(`${totalMismatches} behind scheduler`);
  }
  if (totalErrors > 0) {
    summaryParts.push(`${totalErrors} check errors`);
  }
  
  if (summaryParts.length > 0) {
    text += `\n${summaryParts.join(', ')}`;
  }
  
  const attachments = [];
  
  // Add mismatch attachments (limited to first 8 to make room for errors)
  if (totalMismatches > 0) {
    const mismatchAttachments = mismatches.slice(0, 8).map(mismatch => {
      const diff = Math.abs(parseInt(mismatch.stateNonce) - parseInt(mismatch.suRouterNonce));
      const color = diff >= 100 ? 'danger' : diff >= 50 ? 'warning' : 'good';
      
      return {
        color: color,
        fields: [
          { title: 'Process ID', value: truncateProcessId(mismatch.processId), short: true },
          { title: 'State Nonce', value: String(mismatch.stateNonce), short: true },
          { title: 'SU Router Nonce', value: String(mismatch.suRouterNonce), short: true },
          { title: 'Difference', value: `${diff} slots`, short: true }
        ]
      };
    });
    
    attachments.push(...mismatchAttachments);
    
    if (totalMismatches > 8) {
      attachments.push({
        color: 'good',
        text: `... and ${totalMismatches - 8} more mismatches`
      });
    }
  }
  
  // Add error attachments (limited to avoid message size limits)
  if (totalErrors > 0) {
    const errorAttachments = errors.slice(0, 3).map(err => ({
      color: 'warning',
      fields: [
        { title: 'Process ID', value: truncateProcessId(err.processId), short: true },
        { title: 'Error', value: err.error.substring(0, 100) + (err.error.length > 100 ? '...' : ''), short: false }
      ]
    }));
    
    attachments.push(...errorAttachments);
    
    if (totalErrors > 3) {
      attachments.push({
        color: 'warning',
        text: `... and ${totalErrors - 3} more errors`
      });
    }
  }
  
  // Add footer with timestamp
  attachments.push({
    color: 'good',
    fields: [
      { title: 'Timestamp', value: getTimestamp(), short: false }
    ],
    footer: 'AO Network Monitor',
    ts: Math.floor(Date.now() / 1000)
  });
  
  return {
    text,
    attachments,
    footer: 'AO Network Nonce Monitor',
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
      reject(new Error('Request timeout after 5000ms'));
    });
    
    req.write(payload);
    req.end();
  });
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

async function fetchWithRetry(url, timeout, retryOptions = {}) {
  const maxRetries = parseInt(process.env.SU_ROUTER_MAX_RETRIES || retryOptions.maxRetries || '5');
  const baseDelay = parseInt(process.env.SU_ROUTER_BASE_DELAY || retryOptions.baseDelay || '1000');
  const maxDelay = parseInt(process.env.SU_ROUTER_MAX_DELAY || retryOptions.maxDelay || '30000');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, timeout);
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries + 1} attempts: ${error.message}`);
      }
      
      if (!isRetryableError(error)) {
        throw error;
      }
      
      const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      console.log(`[${getTimestamp()}] [SU Router Retry] Attempt ${attempt + 1}/${maxRetries} for ${url} after ${Math.round(delay)}ms delay: ${error.message}`);
      
      await sleep(delay);
    }
  }
}

async function fetchStateNonce(stateUrl) {
  try {
    const response = await fetchWithTimeout(stateUrl, REQUEST_TIMEOUT);
    const text = await response.text();
    const nonce = text.trim();
    
    if (!nonce) {
      throw new Error('State endpoint returned empty nonce');
    }
    
    return nonce;
  } catch (error) {
    throw new Error(`Failed to fetch state nonce: ${error.message}`);
  }
}

async function fetchSURouterNonce(suRouterUrl) {
  try {
    const response = await fetchWithRetry(suRouterUrl, REQUEST_TIMEOUT);
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON response structure');
    }
    
    if (!data.assignment || typeof data.assignment !== 'object') {
      throw new Error('Missing assignment object in response');
    }
    
    if (!Array.isArray(data.assignment.tags)) {
      throw new Error('Missing or invalid assignment.tags array');
    }
    
    const nonceTag = data.assignment.tags.find(tag => tag.name === 'Nonce');
    
    if (!nonceTag) {
      throw new Error('Nonce tag not found in assignment.tags');
    }
    
    if (nonceTag.value === undefined || nonceTag.value === null) {
      throw new Error('Nonce tag has no value');
    }
    
    return String(nonceTag.value);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON from SU Router: ${error.message}`);
    }
    if (error.message.startsWith('Failed after') || 
        error.message.startsWith('Failed to fetch') || 
        error.message.startsWith('Invalid') || 
        error.message.startsWith('Missing') || 
        error.message.startsWith('Nonce')) {
      throw error;
    }
    throw new Error(`Failed to fetch SU Router nonce: ${error.message}`);
  }
}

async function checkProcess(processId) {
  const stateLocation = process.env.STATE_URL || 'https://state.forward.computer'
  const stateUrl = `${stateLocation}/${processId}~process@1.0/compute/at-slot`;
  const suRouterUrl = `https://su-router.ao-testnet.xyz/${processId}/latest`;
  
  try {
    const [stateNonce, suRouterNonce] = await Promise.all([
      fetchStateNonce(stateUrl),
      fetchSURouterNonce(suRouterUrl)
    ]);
    
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

async function checkAllProcesses(processIds) {
  const results = [];
  
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
  
  return errors > 0 ? 1 : 0;
}

async function main() {
  const configFile = process.env.CONFIG_FILE || './process-ids.txt';
  
  if (fs.existsSync(configFile)) {
    try {
      const processIds = loadConfig(configFile);
      const results = await checkAllProcesses(processIds);
      const exitCode = generateSummary(results);
      
      const mismatches = results
        .filter(r => {
          if (r.error || r.match) return false;
          const diff = Math.abs(parseInt(r.stateNonce) - parseInt(r.suRouterNonce));
          return diff >= 50;
        })
        .map(r => ({
          processId: r.processId,
          stateNonce: r.stateNonce,
          suRouterNonce: r.suRouterNonce,
          timestamp: getTimestamp()
        }));
      
      const errors = results
        .filter(r => r.error)
        .map(r => ({
          processId: r.processId,
          error: r.error,
          timestamp: getTimestamp()
        }));
      
      // Use consolidated alerting instead of individual alerts
      const hasIssues = mismatches.length > 0 || errors.length > 0;
      
      if (hasIssues) {
        // Send consolidated Slack alert
        await sendConsolidatedSlackAlert(mismatches, errors, {
          context: 'Nonce Monitor Check'
        });
        
        // Send consolidated PagerDuty event
        const pdConfig = pagerduty.getConfigFromEnv();
        if (pdConfig.enabled) {
          const allIncidents = [...mismatches, ...errors];
          await pagerduty.sendAggregatedPagerDutyEvent(allIncidents, 'trigger', pdConfig, {
            context: 'Nonce Monitor Check',
            type: 'nonce-monitor',
            dedupKey: `nonce-monitor-${getTimestamp().split('T')[0]}` // Daily dedup key
          });
        }
      }
      
      process.exit(exitCode);
    } catch (error) {
      logError(null, error.message);
      process.exit(1);
    }
  } else {
    const processId = process.env.PROCESS_ID;
    
    if (!processId) {
      logError(null, `No config file found at ${configFile} and PROCESS_ID environment variable not set. Please provide either a config file or set PROCESS_ID.`);
      process.exit(1);
    }
    
    try {
      const [stateNonce, suRouterNonce] = await Promise.all([
        fetchStateNonce(`https://state.forward.computer/${processId}/compute/at-slot`),
        fetchSURouterNonce(`https://su-router.ao-testnet.xyz/${processId}/latest`)
      ]);
      
      logResult(null, stateNonce, suRouterNonce);
      
      const match = String(stateNonce) === String(suRouterNonce);
      if (!match) {
        const diff = Math.abs(parseInt(stateNonce) - parseInt(suRouterNonce));
        if (diff >= 50) {
          const mismatches = [{
            processId,
            stateNonce,
            suRouterNonce,
            timestamp: getTimestamp()
          }];
          await sendSlackAlert(mismatches);
          
          const pdConfig = pagerduty.getConfigFromEnv();
          if (pdConfig.enabled) {
            await pagerduty.sendPagerDutyEvent(mismatches, 'trigger', pdConfig);
          }
        }
      }
      
      process.exit(0);
    } catch (error) {
      logError(null, error.message);
      process.exit(1);
    }
  }
}

main();
