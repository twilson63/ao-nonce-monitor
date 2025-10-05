#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pagerduty = require('./lib/pagerduty');

const TEST_STATE_DIR = path.join(__dirname, 'test-pagerduty-state');
const TEST_STATE_FILE = path.join(TEST_STATE_DIR, 'test-state.json');

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

function setupTestConfigs() {
  if (!fs.existsSync(TEST_STATE_DIR)) {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
  }
}

function cleanupTestConfigs() {
  if (fs.existsSync(TEST_STATE_DIR)) {
    const files = fs.readdirSync(TEST_STATE_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEST_STATE_DIR, file));
    }
    fs.rmdirSync(TEST_STATE_DIR);
  }
}

async function runUnitTests() {
  console.log('=== Unit Tests ===\n');

  try {
    const dedupKey = pagerduty.generateDedupKey('test-process-123', 'mismatch');
    const regex = /^nonce-monitor-mismatch-test-process-123-\d{8}$/;
    if (regex.test(dedupKey)) {
      pass('Test 1: generateDedupKey() format correct for mismatch type');
    } else {
      fail(`Test 1: generateDedupKey() format incorrect (got: ${dedupKey})`);
    }
  } catch (error) {
    fail(`Test 1: generateDedupKey() (${error.message})`);
  }

  try {
    const errorDedupKey = pagerduty.generateDedupKey('test-process-456', 'error');
    const regex = /^nonce-monitor-error-test-process-456-\d{8}$/;
    if (regex.test(errorDedupKey)) {
      pass('Test 2: generateDedupKey() format correct for error type');
    } else {
      fail(`Test 2: generateDedupKey() format incorrect (got: ${errorDedupKey})`);
    }
  } catch (error) {
    fail(`Test 2: generateDedupKey() (${error.message})`);
  }

  try {
    const dedupKey = pagerduty.generateDedupKey('proc-789', 'mismatch');
    const dateMatch = dedupKey.match(/(\d{8})$/);
    if (dateMatch && dateMatch[1].length === 8) {
      const dateStr = dateMatch[1];
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10);
      const day = parseInt(dateStr.substring(6, 8), 10);
      if (year >= 2025 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        pass(`Test 3: generateDedupKey() date format is YYYYMMDD (${dateStr})`);
      } else {
        fail(`Test 3: generateDedupKey() invalid date values (${dateStr})`);
      }
    } else {
      fail(`Test 3: generateDedupKey() date format not YYYYMMDD (got: ${dedupKey})`);
    }
  } catch (error) {
    fail(`Test 3: generateDedupKey() (${error.message})`);
  }

  try {
    const incident = {
      processId: 'test-proc',
      stateNonce: '100',
      suRouterNonce: '150',
      type: 'mismatch'
    };
    const config = { routingKey: 'test-key' };
    const payload = pagerduty.buildEventPayload(incident, 'trigger', config);
    
    if (payload.routing_key === 'test-key' &&
        payload.event_action === 'trigger' &&
        payload.dedup_key &&
        payload.payload) {
      pass('Test 4: buildEventPayload() has required fields');
    } else {
      fail('Test 4: buildEventPayload() missing required fields');
    }
  } catch (error) {
    fail(`Test 4: buildEventPayload() (${error.message})`);
  }

  try {
    const incident = {
      processId: 'test-proc',
      stateNonce: '100',
      suRouterNonce: '150',
      type: 'mismatch'
    };
    const config = { routingKey: 'test-key' };
    const payload = pagerduty.buildEventPayload(incident, 'trigger', config);
    
    if (payload.payload.summary &&
        payload.payload.severity &&
        payload.payload.source &&
        payload.payload.timestamp) {
      pass('Test 5: buildEventPayload() payload has required fields');
    } else {
      fail('Test 5: buildEventPayload() payload missing fields');
    }
  } catch (error) {
    fail(`Test 5: buildEventPayload() (${error.message})`);
  }

  try {
    const incident = {
      processId: 'test-proc',
      stateNonce: '100',
      suRouterNonce: '150',
      type: 'mismatch'
    };
    const config = { routingKey: 'test-key' };
    const payload = pagerduty.buildEventPayload(incident, 'trigger', config);
    
    if (payload.payload.custom_details &&
        payload.payload.custom_details.processId === 'test-proc' &&
        payload.payload.custom_details.stateNonce === '100' &&
        payload.payload.custom_details.suRouterNonce === '150') {
      pass('Test 6: buildEventPayload() includes custom details');
    } else {
      fail('Test 6: buildEventPayload() custom details incorrect');
    }
  } catch (error) {
    fail(`Test 6: buildEventPayload() (${error.message})`);
  }

  setupTestConfigs();

  try {
    const testState = { 'proc-1': { dedupKey: 'test-key-1', alertedAt: '2025-01-01' } };
    pagerduty.saveState(TEST_STATE_FILE, testState);
    const loadedState = pagerduty.loadState(TEST_STATE_FILE);
    
    if (loadedState['proc-1'] && loadedState['proc-1'].dedupKey === 'test-key-1') {
      pass('Test 7: State save and load round-trip works');
    } else {
      fail('Test 7: State save and load round-trip failed');
    }
  } catch (error) {
    fail(`Test 7: State save/load (${error.message})`);
  }

  try {
    const missingFilePath = path.join(TEST_STATE_DIR, 'missing-file.json');
    const state = pagerduty.loadState(missingFilePath);
    
    if (state && Object.keys(state).length === 0) {
      pass('Test 8: loadState() returns empty object for missing file');
    } else {
      fail('Test 8: loadState() did not return empty object for missing file');
    }
  } catch (error) {
    fail(`Test 8: loadState() missing file (${error.message})`);
  }

  try {
    const corruptedFilePath = path.join(TEST_STATE_DIR, 'corrupted.json');
    fs.writeFileSync(corruptedFilePath, '{ invalid json content', 'utf8');
    
    const state = pagerduty.loadState(corruptedFilePath);
    
    if (state && Object.keys(state).length === 0) {
      pass('Test 9: loadState() handles corrupted JSON gracefully');
    } else {
      fail('Test 9: loadState() did not handle corrupted JSON');
    }
  } catch (error) {
    fail(`Test 9: loadState() corrupted JSON (${error.message})`);
  }

  cleanupTestConfigs();
}

async function runConfigurationTests() {
  console.log('\n=== Configuration Tests ===\n');

  try {
    const oldEnabled = process.env.PAGERDUTY_ENABLED;
    const oldRoutingKey = process.env.PAGERDUTY_ROUTING_KEY;
    
    process.env.PAGERDUTY_ENABLED = 'false';
    delete process.env.PAGERDUTY_ROUTING_KEY;
    
    const config = pagerduty.getConfigFromEnv();
    
    if (config.enabled === false) {
      pass('Test 10: getConfigFromEnv() with PAGERDUTY_ENABLED=false');
    } else {
      fail('Test 10: getConfigFromEnv() enabled should be false');
    }
    
    if (oldEnabled) process.env.PAGERDUTY_ENABLED = oldEnabled;
    else delete process.env.PAGERDUTY_ENABLED;
    if (oldRoutingKey) process.env.PAGERDUTY_ROUTING_KEY = oldRoutingKey;
  } catch (error) {
    fail(`Test 10: getConfigFromEnv() (${error.message})`);
  }

  try {
    const oldEnabled = process.env.PAGERDUTY_ENABLED;
    const oldRoutingKey = process.env.PAGERDUTY_ROUTING_KEY;
    
    process.env.PAGERDUTY_ENABLED = 'true';
    process.env.PAGERDUTY_ROUTING_KEY = 'test-routing-key-123';
    
    const config = pagerduty.getConfigFromEnv();
    
    if (config.enabled === true && config.routingKey === 'test-routing-key-123') {
      pass('Test 11: getConfigFromEnv() with PAGERDUTY_ENABLED=true returns config');
    } else {
      fail('Test 11: getConfigFromEnv() config incorrect');
    }
    
    if (oldEnabled) process.env.PAGERDUTY_ENABLED = oldEnabled;
    else delete process.env.PAGERDUTY_ENABLED;
    if (oldRoutingKey) process.env.PAGERDUTY_ROUTING_KEY = oldRoutingKey;
    else delete process.env.PAGERDUTY_ROUTING_KEY;
  } catch (error) {
    fail(`Test 11: getConfigFromEnv() (${error.message})`);
  }

  try {
    const oldThreshold = process.env.PAGERDUTY_SEVERITY_THRESHOLD;
    
    process.env.PAGERDUTY_SEVERITY_THRESHOLD = '100';
    
    const config = pagerduty.getConfigFromEnv();
    
    if (config.threshold === 100) {
      pass('Test 12: Custom PAGERDUTY_SEVERITY_THRESHOLD parsed correctly');
    } else {
      fail(`Test 12: Custom threshold incorrect (got: ${config.threshold})`);
    }
    
    if (oldThreshold) process.env.PAGERDUTY_SEVERITY_THRESHOLD = oldThreshold;
    else delete process.env.PAGERDUTY_SEVERITY_THRESHOLD;
  } catch (error) {
    fail(`Test 12: Custom threshold (${error.message})`);
  }
}

async function runIntegrationTests() {
  console.log('\n=== Integration Tests ===\n');

  try {
    const incidents = [
      { processId: 'proc-1', stateNonce: '100', suRouterNonce: '150' }
    ];
    const config = { enabled: false, routingKey: 'test-key' };
    
    const results = await pagerduty.sendPagerDutyEvent(incidents, 'trigger', config);
    
    if (results.length === 0) {
      pass('Test 13: sendPagerDutyEvent() with enabled=false returns early');
    } else {
      fail('Test 13: sendPagerDutyEvent() should return empty array when disabled');
    }
  } catch (error) {
    fail(`Test 13: sendPagerDutyEvent() disabled (${error.message})`);
  }

  try {
    const incidents = [
      { processId: 'proc-1', stateNonce: '100', suRouterNonce: '150' }
    ];
    const config = { enabled: true, routingKey: '' };
    
    const results = await pagerduty.sendPagerDutyEvent(incidents, 'trigger', config);
    
    if (results.length === 0) {
      pass('Test 14: sendPagerDutyEvent() with missing routing key returns empty');
    } else {
      fail('Test 14: sendPagerDutyEvent() should return empty for missing key');
    }
  } catch (error) {
    fail(`Test 14: sendPagerDutyEvent() missing key (${error.message})`);
  }

  try {
    const incident = {
      processId: 'test-proc',
      stateNonce: '100',
      suRouterNonce: '150'
    };
    const config = { routingKey: 'test-key' };
    const payload = pagerduty.buildEventPayload(incident, 'trigger', config);
    
    if (payload.payload.summary.includes('test-proc') &&
        payload.payload.custom_details.processId &&
        payload.payload.custom_details.stateNonce &&
        payload.payload.custom_details.suRouterNonce) {
      pass('Test 15: buildEventPayload() trigger action includes full details');
    } else {
      fail('Test 15: buildEventPayload() trigger missing details');
    }
  } catch (error) {
    fail(`Test 15: buildEventPayload() trigger (${error.message})`);
  }

  try {
    const incident = {
      processId: 'test-proc',
      dedupKey: 'stored-dedup-key-123'
    };
    const config = { routingKey: 'test-key' };
    const payload = pagerduty.buildEventPayload(incident, 'resolve', config);
    
    if (payload.dedup_key === 'stored-dedup-key-123' &&
        payload.event_action === 'resolve' &&
        !payload.payload) {
      pass('Test 16: buildEventPayload() resolve action uses stored dedup key');
    } else {
      fail('Test 16: buildEventPayload() resolve incorrect');
    }
  } catch (error) {
    fail(`Test 16: buildEventPayload() resolve (${error.message})`);
  }

  try {
    const key1 = pagerduty.generateDedupKey('same-process', 'mismatch');
    const key2 = pagerduty.generateDedupKey('same-process', 'mismatch');
    
    if (key1 === key2) {
      pass('Test 17: Deduplication - same process/day uses same key');
    } else {
      fail(`Test 17: Deduplication - keys differ (${key1} vs ${key2})`);
    }
  } catch (error) {
    fail(`Test 17: Deduplication same day (${error.message})`);
  }

  try {
    const origDate = Date;
    global.Date = class extends Date {
      constructor() {
        super();
        return new origDate('2025-01-01T00:00:00Z');
      }
      static now() {
        return new origDate('2025-01-01T00:00:00Z').getTime();
      }
    };
    
    const key1 = pagerduty.generateDedupKey('same-process', 'mismatch');
    
    global.Date = class extends origDate {
      constructor() {
        super();
        return new origDate('2025-01-02T00:00:00Z');
      }
      static now() {
        return new origDate('2025-01-02T00:00:00Z').getTime();
      }
    };
    
    const key2 = pagerduty.generateDedupKey('same-process', 'mismatch');
    
    global.Date = origDate;
    
    if (key1 !== key2 && key1.includes('20250101') && key2.includes('20250102')) {
      pass('Test 18: Deduplication - different day rotates key');
    } else {
      fail(`Test 18: Deduplication - keys should differ by date (${key1} vs ${key2})`);
    }
  } catch (error) {
    fail(`Test 18: Deduplication different day (${error.message})`);
  }
}

async function runErrorHandlingTests() {
  console.log('\n=== Error Handling Tests ===\n');

  setupTestConfigs();

  try {
    const missingPath = path.join(TEST_STATE_DIR, 'definitely-missing.json');
    let crashed = false;
    
    try {
      const state = pagerduty.loadState(missingPath);
      if (state && typeof state === 'object') {
        pass('Test 19: loadState() with missing file does not crash');
      } else {
        fail('Test 19: loadState() returned invalid state');
      }
    } catch (error) {
      crashed = true;
      fail(`Test 19: loadState() crashed (${error.message})`);
    }
  } catch (error) {
    fail(`Test 19: loadState() missing file (${error.message})`);
  }

  try {
    const invalidPath = '/invalid/nonexistent/path/state.json';
    let crashed = false;
    
    try {
      pagerduty.saveState(invalidPath, { test: 'data' });
      pass('Test 20: saveState() with invalid path logs error gracefully');
    } catch (error) {
      crashed = true;
      fail(`Test 20: saveState() crashed (${error.message})`);
    }
  } catch (error) {
    fail(`Test 20: saveState() invalid path (${error.message})`);
  }

  try {
    const config = { enabled: true, routingKey: 'test-key' };
    const results = await pagerduty.sendPagerDutyEvent([], 'trigger', config);
    
    if (results.length === 0) {
      pass('Test 21: sendPagerDutyEvent() handles empty incidents array');
    } else {
      fail('Test 21: sendPagerDutyEvent() should return empty for empty incidents');
    }
  } catch (error) {
    fail(`Test 21: sendPagerDutyEvent() empty array (${error.message})`);
  }

  cleanupTestConfigs();
}

async function runAdditionalTests() {
  console.log('\n=== Additional Tests ===\n');

  try {
    const incident = {
      processId: 'test-proc',
      error: 'Network timeout'
    };
    const config = { routingKey: 'test-key' };
    const payload = pagerduty.buildEventPayload(incident, 'trigger', config);
    
    if (payload.payload.summary.includes('error') &&
        payload.payload.custom_details.error === 'Network timeout') {
      pass('Test 22: buildEventPayload() handles error incidents correctly');
    } else {
      fail('Test 22: buildEventPayload() error handling incorrect');
    }
  } catch (error) {
    fail(`Test 22: buildEventPayload() error incident (${error.message})`);
  }

  try {
    const incident1 = {
      processId: 'proc-high',
      stateNonce: '100',
      suRouterNonce: '250'
    };
    const incident2 = {
      processId: 'proc-medium',
      stateNonce: '100',
      suRouterNonce: '160'
    };
    const incident3 = {
      processId: 'proc-low',
      stateNonce: '100',
      suRouterNonce: '130'
    };
    
    const config = { routingKey: 'test-key' };
    const payload1 = pagerduty.buildEventPayload(incident1, 'trigger', config);
    const payload2 = pagerduty.buildEventPayload(incident2, 'trigger', config);
    const payload3 = pagerduty.buildEventPayload(incident3, 'trigger', config);
    
    if (payload1.payload.severity === 'critical' &&
        payload2.payload.severity === 'error' &&
        payload3.payload.severity === 'warning') {
      pass('Test 23: Severity levels calculated correctly (critical/error/warning)');
    } else {
      fail(`Test 23: Severity incorrect (${payload1.payload.severity}/${payload2.payload.severity}/${payload3.payload.severity})`);
    }
  } catch (error) {
    fail(`Test 23: Severity levels (${error.message})`);
  }

  try {
    const oldAutoResolve = process.env.PAGERDUTY_AUTO_RESOLVE;
    
    process.env.PAGERDUTY_AUTO_RESOLVE = 'false';
    const config1 = pagerduty.getConfigFromEnv();
    
    delete process.env.PAGERDUTY_AUTO_RESOLVE;
    const config2 = pagerduty.getConfigFromEnv();
    
    if (config1.autoResolve === false && config2.autoResolve === true) {
      pass('Test 24: PAGERDUTY_AUTO_RESOLVE flag works correctly');
    } else {
      fail(`Test 24: Auto-resolve flag incorrect (${config1.autoResolve}/${config2.autoResolve})`);
    }
    
    if (oldAutoResolve) process.env.PAGERDUTY_AUTO_RESOLVE = oldAutoResolve;
  } catch (error) {
    fail(`Test 24: Auto-resolve flag (${error.message})`);
  }
}

async function runTests() {
  console.log('Running PagerDuty Integration Tests...\n');

  await runUnitTests();
  await runConfigurationTests();
  await runIntegrationTests();
  await runErrorHandlingTests();
  await runAdditionalTests();

  console.log('\n=== Results ===');
  console.log(`Tests Passed: ${testsPassed}/24`);
  console.log(`Tests Failed: ${testsFailed}/24`);

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
