const fs = require('fs');
const https = require('https');

function getTimestamp() {
  return new Date().toISOString();
}

function getConfigFromEnv() {
  const enabled = process.env.PAGERDUTY_ENABLED === 'true';
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY || '';
  const threshold = parseInt(process.env.PAGERDUTY_SEVERITY_THRESHOLD || '50', 10);
  const autoResolve = process.env.PAGERDUTY_AUTO_RESOLVE !== 'false';
  
  return {
    routingKey,
    enabled,
    threshold,
    autoResolve
  };
}

function generateDedupKey(processId, type) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  return `nonce-monitor-${type}-${processId}-${dateStr}`;
}

function buildEventPayload(incident, eventAction, config) {
  const payload = {
    routing_key: config.routingKey,
    event_action: eventAction
  };
  
  if (eventAction === 'trigger') {
    const diff = Math.abs(parseInt(incident.stateNonce) - parseInt(incident.suRouterNonce));
    const severity = diff >= 100 ? 'critical' : diff >= 50 ? 'error' : 'warning';
    
    payload.dedup_key = incident.dedupKey || generateDedupKey(incident.processId, incident.type || 'mismatch');
    payload.payload = {
      summary: incident.error 
        ? `Process check error: ${incident.processId}` 
        : `Process ${incident.processId} is ${diff} slots behind scheduler`,
      severity: severity,
      source: 'nonce-monitor',
      timestamp: new Date().toISOString(),
      custom_details: {
        processId: incident.processId,
        stateNonce: incident.stateNonce,
        suRouterNonce: incident.suRouterNonce,
        slotsBehind: incident.error ? null : diff,
        error: incident.error || null
      }
    };
  } else if (eventAction === 'resolve' || eventAction === 'acknowledge') {
    payload.dedup_key = incident.dedupKey || generateDedupKey(incident.processId, incident.type || 'mismatch');
  }
  
  return payload;
}

function postToPagerDuty(payload) {
  return new Promise((resolve, reject) => {
    const url = 'https://events.pagerduty.com/v2/enqueue';
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'events.pagerduty.com',
      path: '/v2/enqueue',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 202) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
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
    
    req.write(data);
    req.end();
  });
}

async function sendPagerDutyEvent(incidents, eventAction, config) {
  if (!config.enabled) {
    return [];
  }
  
  if (!config.routingKey) {
    console.error(`[${getTimestamp()}] ERROR: PAGERDUTY_ROUTING_KEY not configured`);
    return [];
  }
  
  if (!incidents || incidents.length === 0) {
    return [];
  }
  
  const results = [];
  
  for (const incident of incidents) {
    try {
      const payload = buildEventPayload(incident, eventAction, config);
      await postToPagerDuty(payload);
      
      console.log(`[${getTimestamp()}] PagerDuty event sent: ${eventAction} for ${incident.processId}`);
      results.push({ processId: incident.processId, success: true, action: eventAction });
    } catch (error) {
      console.error(`[${getTimestamp()}] Failed to send PagerDuty event for ${incident.processId}: ${error.message}`);
      results.push({ processId: incident.processId, success: false, action: eventAction, error: error.message });
    }
  }
  
  return results;
}

function loadState(stateFile) {
  try {
    if (!fs.existsSync(stateFile)) {
      return {};
    }
    
    const content = fs.readFileSync(stateFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`[${getTimestamp()}] WARNING: Corrupted state file, starting fresh: ${error.message}`);
      return {};
    }
    console.warn(`[${getTimestamp()}] WARNING: Failed to load state file: ${error.message}`);
    return {};
  }
}

function saveState(stateFile, state) {
  try {
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(stateFile, data, 'utf8');
  } catch (error) {
    console.error(`[${getTimestamp()}] ERROR: Failed to save state file: ${error.message}`);
  }
}

module.exports = {
  sendPagerDutyEvent,
  buildEventPayload,
  generateDedupKey,
  loadState,
  saveState,
  getConfigFromEnv
};
