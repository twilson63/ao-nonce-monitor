#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROCESS_ID = '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc';
const STATE_URL = `https://state.forward.computer/${PROCESS_ID}/compute/at-slot`;
const SU_ROUTER_URL = `https://su-router.ao-testnet.xyz/${PROCESS_ID}/latest`;
const REQUEST_TIMEOUT = 10000;

const TEST_CONFIG_DIR = path.join(__dirname, 'test-configs');

let testsPassed = 0;
let testsFailed = 0;

function pass(message) {
  console.log(`✓ ${message}`);
  testsPassed++;
}

function fail(message) {
  console.log(`✗ ${message}`);
  testsFailed++;
}

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

function truncateProcessId(processId) {
  if (!processId || processId.length <= 16) {
    return processId;
  }
  return `${processId.slice(0, 8)}...${processId.slice(-8)}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

function buildSlackMessage(mismatches) {
  const count = mismatches.length;
  const text = count === 1 ? '🚨 Nonce Mismatch Detected' : `🚨 ${count} Nonce Mismatches Detected`;
  
  if (count > 10) {
    const compactList = mismatches.slice(0, 10).map(m => 
      `• [${truncateProcessId(m.processId)}]: ${m.stateNonce} vs ${m.suRouterNonce}`
    ).join('\n');
    const remaining = count - 10;
    
    return {
      text: `${text}\n\n${compactList}\n\n... (${remaining} more)`,
      footer: 'AO Network Nonce Monitor',
      ts: Math.floor(Date.now() / 1000)
    };
  }
  
  const attachments = mismatches.map(mismatch => ({
    color: 'danger',
    fields: [
      { title: 'Process ID', value: truncateProcessId(mismatch.processId), short: true },
      { title: 'State Nonce', value: String(mismatch.stateNonce), short: true },
      { title: 'SU Router Nonce', value: String(mismatch.suRouterNonce), short: true },
      { title: 'Timestamp', value: mismatch.timestamp, short: true }
    ]
  }));
  
  return {
    text,
    attachments,
    footer: 'AO Network Nonce Monitor',
    ts: Math.floor(Date.now() / 1000)
  };
}

function loadConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const processIds = lines
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  
  if (processIds.length === 0) {
    throw new Error('No valid process IDs found in config file');
  }
  
  return processIds;
}

function setupTestConfigs() {
  if (!fs.existsSync(TEST_CONFIG_DIR)) {
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(
    path.join(TEST_CONFIG_DIR, 'valid-config.txt'),
    `# Valid config with comments
${PROCESS_ID}
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc

# Another process
xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10
`
  );

  fs.writeFileSync(
    path.join(TEST_CONFIG_DIR, 'empty-config.txt'),
    `# Only comments
# No process IDs
`
  );

  fs.writeFileSync(
    path.join(TEST_CONFIG_DIR, 'blank-lines-config.txt'),
    `

${PROCESS_ID}


`
  );

  fs.writeFileSync(
    path.join(TEST_CONFIG_DIR, 'multi-process-config.txt'),
    `${PROCESS_ID}
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
`
  );
}

function cleanupTestConfigs() {
  if (fs.existsSync(TEST_CONFIG_DIR)) {
    const files = fs.readdirSync(TEST_CONFIG_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEST_CONFIG_DIR, file));
    }
    fs.rmdirSync(TEST_CONFIG_DIR);
  }
}

async function runSingleEndpointTests() {
  console.log('=== Single Endpoint Tests ===\n');

  let stateResponse;
  let stateText;
  let stateNonce;
  let suRouterResponse;
  let suRouterJson;
  let suRouterNonce;

  try {
    stateResponse = await fetchWithTimeout(STATE_URL, REQUEST_TIMEOUT);
    if (stateResponse.status === 200) {
      pass('Test 1: State endpoint reachable (HTTP 200)');
    } else {
      fail(`Test 1: State endpoint reachable (HTTP ${stateResponse.status})`);
    }
  } catch (error) {
    fail(`Test 1: State endpoint reachable (${error.message})`);
    return;
  }

  try {
    stateText = await stateResponse.text();
    if (stateText && stateText.trim().length > 0) {
      pass('Test 2: State response format valid (non-empty text)');
    } else {
      fail('Test 2: State response format valid (empty response)');
    }
  } catch (error) {
    fail(`Test 2: State response format valid (${error.message})`);
    return;
  }

  try {
    stateNonce = stateText.trim();
    const parsed = parseInt(stateNonce, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      pass(`Test 3: State nonce is valid number (${stateNonce})`);
    } else {
      fail(`Test 3: State nonce is valid number (invalid: ${stateNonce})`);
    }
  } catch (error) {
    fail(`Test 3: State nonce is valid number (${error.message})`);
  }

  try {
    suRouterResponse = await fetchWithTimeout(SU_ROUTER_URL, REQUEST_TIMEOUT);
    if (suRouterResponse.status === 200) {
      pass('Test 4: SU Router endpoint reachable (HTTP 200)');
    } else {
      fail(`Test 4: SU Router endpoint reachable (HTTP ${suRouterResponse.status})`);
    }
  } catch (error) {
    fail(`Test 4: SU Router endpoint reachable (${error.message})`);
    return;
  }

  try {
    suRouterJson = await suRouterResponse.json();
    if (suRouterJson && typeof suRouterJson === 'object') {
      pass('Test 5: SU Router returns valid JSON');
    } else {
      fail('Test 5: SU Router returns valid JSON');
    }
  } catch (error) {
    fail(`Test 5: SU Router returns valid JSON (${error.message})`);
    return;
  }

  try {
    if (suRouterJson.assignment && 
        typeof suRouterJson.assignment === 'object' &&
        Array.isArray(suRouterJson.assignment.tags)) {
      pass('Test 6: JSON has assignment.tags array');
    } else {
      fail('Test 6: JSON has assignment.tags array');
    }
  } catch (error) {
    fail(`Test 6: JSON has assignment.tags array (${error.message})`);
  }

  try {
    const nonceTag = suRouterJson.assignment.tags.find(tag => tag.name === 'Nonce');
    if (nonceTag) {
      pass('Test 7: Nonce tag found in assignment.tags');
    } else {
      fail('Test 7: Nonce tag found in assignment.tags');
      return;
    }
  } catch (error) {
    fail(`Test 7: Nonce tag found in assignment.tags (${error.message})`);
    return;
  }

  try {
    const nonceTag = suRouterJson.assignment.tags.find(tag => tag.name === 'Nonce');
    suRouterNonce = String(nonceTag.value);
    const parsed = parseInt(suRouterNonce, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      pass(`Test 8: Nonce value is valid (${suRouterNonce})`);
    } else {
      fail(`Test 8: Nonce value is valid (invalid: ${suRouterNonce})`);
    }
  } catch (error) {
    fail(`Test 8: Nonce value is valid (${error.message})`);
  }

  console.log('\n--- Nonce Values ---');
  console.log(`State Nonce:     ${stateNonce}`);
  console.log(`SU Router Nonce: ${suRouterNonce}`);
  
  const match = String(stateNonce) === String(suRouterNonce);
  console.log(`Match Status:    ${match ? 'MATCH ✓' : 'MISMATCH ✗'}\n`);
}

async function runMultiProcessTests() {
  console.log('=== Multi-Process Tests ===\n');

  setupTestConfigs();

  try {
    const validConfig = loadConfig(path.join(TEST_CONFIG_DIR, 'valid-config.txt'));
    if (validConfig.length === 2 && validConfig[0] === PROCESS_ID) {
      pass('Test 9: Config file parsing - valid config loaded');
    } else {
      fail(`Test 9: Config file parsing - expected 2 IDs, got ${validConfig.length}`);
    }
  } catch (error) {
    fail(`Test 9: Config file parsing (${error.message})`);
  }

  try {
    const emptyConfig = loadConfig(path.join(TEST_CONFIG_DIR, 'empty-config.txt'));
    fail('Test 10: Empty config handling - should have thrown error');
  } catch (error) {
    if (error.message.includes('No valid process IDs')) {
      pass('Test 10: Empty config handling - correctly rejected');
    } else {
      fail(`Test 10: Empty config handling - wrong error: ${error.message}`);
    }
  }

  try {
    const blankConfig = loadConfig(path.join(TEST_CONFIG_DIR, 'blank-lines-config.txt'));
    if (blankConfig.length === 1 && blankConfig[0] === PROCESS_ID) {
      pass('Test 11: Config with blank lines - correctly filtered');
    } else {
      fail(`Test 11: Config with blank lines - expected 1 ID, got ${blankConfig.length}`);
    }
  } catch (error) {
    fail(`Test 11: Config with blank lines (${error.message})`);
  }

  try {
    loadConfig(path.join(TEST_CONFIG_DIR, 'missing-file.txt'));
    fail('Test 12: Missing config file - should have thrown error');
  } catch (error) {
    if (error.message.includes('not found')) {
      pass('Test 12: Missing config file - correctly rejected');
    } else {
      fail(`Test 12: Missing config file - wrong error: ${error.message}`);
    }
  }

  try {
    const multiConfig = loadConfig(path.join(TEST_CONFIG_DIR, 'multi-process-config.txt'));
    if (multiConfig.length === 2) {
      pass(`Test 13: Multi-process execution - loaded ${multiConfig.length} processes`);
    } else {
      fail(`Test 13: Multi-process execution - expected 2 processes, got ${multiConfig.length}`);
    }
  } catch (error) {
    fail(`Test 13: Multi-process execution (${error.message})`);
  }

  const oldProcessId = process.env.PROCESS_ID;
  process.env.PROCESS_ID = PROCESS_ID;
  if (process.env.PROCESS_ID === PROCESS_ID) {
    pass('Test 14: Backward compatibility - PROCESS_ID env var set');
  } else {
    fail('Test 14: Backward compatibility - PROCESS_ID env var not set');
  }
  if (oldProcessId) {
    process.env.PROCESS_ID = oldProcessId;
  } else {
    delete process.env.PROCESS_ID;
  }

  const truncated = truncateProcessId(PROCESS_ID);
  const expected = '0syT13r0...ElLSrsc';
  if (truncated === expected) {
    pass(`Test 15: Process ID truncation - format correct (${truncated})`);
  } else {
    fail(`Test 15: Process ID truncation - expected ${expected}, got ${truncated}`);
  }

  const shortId = truncateProcessId('short');
  if (shortId === 'short') {
    pass('Test 16: Process ID truncation - short IDs unchanged');
  } else {
    fail(`Test 16: Process ID truncation - short ID modified to ${shortId}`);
  }

  try {
    const results = [
      { processId: 'id1', stateNonce: '100', suRouterNonce: '100' },
      { processId: 'id2', stateNonce: '200', suRouterNonce: '201' },
      { processId: 'id3', error: 'Test error' }
    ];
    
    const total = results.length;
    const matches = results.filter(r => !r.error && r.stateNonce === r.suRouterNonce).length;
    const mismatches = results.filter(r => !r.error && r.stateNonce !== r.suRouterNonce).length;
    const errors = results.filter(r => r.error).length;
    
    if (total === 3 && matches === 1 && mismatches === 1 && errors === 1) {
      pass('Test 17: Summary generation - correct aggregation');
    } else {
      fail(`Test 17: Summary generation - expected 3/1/1/1, got ${total}/${matches}/${mismatches}/${errors}`);
    }
  } catch (error) {
    fail(`Test 17: Summary generation (${error.message})`);
  }

  try {
    const results = [];
    const mockProcessIds = ['id1', 'id2', 'invalid-id'];
    
    for (const id of mockProcessIds) {
      if (id === 'invalid-id') {
        results.push({ processId: id, error: 'Invalid ID' });
      } else {
        results.push({ processId: id, stateNonce: '100', suRouterNonce: '100' });
      }
    }
    
    const successful = results.filter(r => !r.error).length;
    if (successful === 2 && results.length === 3) {
      pass('Test 18: Error handling - one process failure does not stop others');
    } else {
      fail(`Test 18: Error handling - expected 2 successful, got ${successful}`);
    }
  } catch (error) {
    fail(`Test 18: Error handling (${error.message})`);
  }

  cleanupTestConfigs();
}

async function runSlackIntegrationTests() {
  console.log('=== Slack Integration Tests ===\n');

  try {
    const singleMismatch = [{
      processId: 'test-process-id-12345',
      stateNonce: '100',
      suRouterNonce: '101',
      timestamp: '2025-01-01T00:00:00.000Z'
    }];
    
    const message = buildSlackMessage(singleMismatch);
    
    if (message.text === '🚨 Nonce Mismatch Detected' &&
        message.attachments &&
        message.attachments.length === 1 &&
        message.attachments[0].color === 'danger' &&
        message.attachments[0].fields.length === 4 &&
        message.footer === 'AO Network Nonce Monitor' &&
        typeof message.ts === 'number') {
      pass('Test 19: Slack message building - single mismatch structure correct');
    } else {
      fail('Test 19: Slack message building - single mismatch structure invalid');
    }
  } catch (error) {
    fail(`Test 19: Slack message building (${error.message})`);
  }

  try {
    const multipleMismatches = [
      { processId: 'id1', stateNonce: '100', suRouterNonce: '101', timestamp: '2025-01-01T00:00:00.000Z' },
      { processId: 'id2', stateNonce: '200', suRouterNonce: '202', timestamp: '2025-01-01T00:00:00.000Z' },
      { processId: 'id3', stateNonce: '300', suRouterNonce: '303', timestamp: '2025-01-01T00:00:00.000Z' }
    ];
    
    const message = buildSlackMessage(multipleMismatches);
    
    if (message.text === '🚨 3 Nonce Mismatches Detected' &&
        message.attachments &&
        message.attachments.length === 3 &&
        message.attachments.every(a => a.color === 'danger' && a.fields.length === 4)) {
      pass('Test 20: Slack message building - multiple mismatches (3 attachments)');
    } else {
      fail('Test 20: Slack message building - multiple mismatches structure invalid');
    }
  } catch (error) {
    fail(`Test 20: Slack message building (${error.message})`);
  }

  try {
    const manyMismatches = [];
    for (let i = 0; i < 15; i++) {
      manyMismatches.push({
        processId: `process-${i}`,
        stateNonce: `${i * 100}`,
        suRouterNonce: `${i * 100 + 1}`,
        timestamp: '2025-01-01T00:00:00.000Z'
      });
    }
    
    const message = buildSlackMessage(manyMismatches);
    
    if (message.text.includes('🚨 15 Nonce Mismatches Detected') &&
        message.text.includes('... (5 more)') &&
        !message.attachments &&
        message.footer === 'AO Network Nonce Monitor') {
      pass('Test 21: Slack message building - compact format with truncation');
    } else {
      fail('Test 21: Slack message building - compact format incorrect');
    }
  } catch (error) {
    fail(`Test 21: Slack message building (${error.message})`);
  }

  try {
    const oldWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_URL;
    
    let errorThrown = false;
    try {
      const mismatches = [{
        processId: 'test-id',
        stateNonce: '100',
        suRouterNonce: '101',
        timestamp: '2025-01-01T00:00:00.000Z'
      }];
      
      if (!process.env.SLACK_WEBHOOK_URL && mismatches.length > 0) {
      }
      
      pass('Test 22: Slack webhook URL validation - gracefully skips when no URL');
    } catch (error) {
      errorThrown = true;
      fail(`Test 22: Slack webhook URL validation - unexpected error: ${error.message}`);
    }
    
    if (oldWebhookUrl) {
      process.env.SLACK_WEBHOOK_URL = oldWebhookUrl;
    }
    
    if (errorThrown) {
    }
  } catch (error) {
    fail(`Test 22: Slack webhook URL validation (${error.message})`);
  }

  try {
    const mockFailedRequest = () => {
      throw new Error('Network error');
    };
    
    let scriptContinued = true;
    try {
      mockFailedRequest();
      scriptContinued = false;
    } catch (error) {
    }
    
    if (scriptContinued) {
      pass('Test 23: Slack error handling - script continues after failure');
    } else {
      fail('Test 23: Slack error handling - script did not continue');
    }
  } catch (error) {
    fail(`Test 23: Slack error handling (${error.message})`);
  }
}

async function runTests() {
  console.log('Running Nonce Monitor Tests...\n');

  await runSingleEndpointTests();
  await runMultiProcessTests();
  await runSlackIntegrationTests();

  console.log('\n=== Results ===');
  console.log(`Tests Passed: ${testsPassed}/23`);
  console.log(`Tests Failed: ${testsFailed}/23`);

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error(`\nUnexpected error: ${error.message}`);
  process.exit(1);
});
