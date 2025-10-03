# Project Request Protocol: Multi-Process Nonce Monitor

## Project Overview

### Purpose
Extend the existing single-process nonce monitor to support monitoring multiple AO network process IDs from a configuration file, enabling centralized monitoring of nonce synchronization across multiple processes.

### Background
The current `nonce-monitor.js` monitors a single process ID (hardcoded default or environment variable). Production environments often need to monitor multiple AO network processes simultaneously. This enhancement will:
- Read process IDs from a configuration file
- Execute nonce checks for each process in the list
- Aggregate and log results for all processes
- Maintain the same reliability and error handling patterns
- Preserve the zero-dependency, cron-compatible execution model

### Current State
**Existing Script:** Single process monitoring
- Monitors one process ID per execution
- Configuration via environment variable or hardcoded default
- Simple output: one log line per execution
- Exit code: 0 (success) or 1 (error)

**Enhancement Needed:** Multi-process monitoring
- Monitor N process IDs from configuration file
- Process IDs defined in external config (not hardcoded)
- Aggregated reporting across all processes
- Individual error handling per process
- Overall success/failure reporting

### Success Indicators
- Configuration file with list of process IDs
- Script reads and validates config file
- Executes checks for all processes (parallel or sequential)
- Clear per-process logging
- Aggregated summary (total, matches, mismatches, errors)
- Backward compatibility with single-process mode
- Maintains zero external dependencies

---

## Technical Requirements

### Functional Requirements

1. **Configuration File Management**
   - Define file format (JSON, YAML, or plain text)
   - Specify default config file location
   - Support custom config file path via CLI argument or environment variable
   - Validate config file exists and is readable
   - Parse and validate process ID list

2. **Multi-Process Checking**
   - Iterate through all process IDs in config
   - Execute nonce checks for each process
   - Handle individual process failures without stopping others
   - Collect results for all processes

3. **Execution Strategy**
   - Choose between parallel or sequential execution
   - Implement timeout per process
   - Implement overall execution timeout

4. **Logging & Reporting**
   - Log individual process results (same format as current)
   - Add process ID identifier to each log line
   - Provide summary report at end:
     - Total processes checked
     - Number of matches
     - Number of mismatches
     - Number of errors
   - Maintain ISO 8601 timestamps

5. **Error Handling**
   - Config file not found
   - Invalid config file format
   - Empty process ID list
   - Individual process check failures
   - Overall timeout exceeded
   - Exit codes: 0 (all success), 1 (some/all failed)

6. **Backward Compatibility**
   - Support existing single-process mode (env var fallback)
   - If config file doesn't exist and PROCESS_ID is set, use single mode
   - Maintain existing CLI interface

### Non-Functional Requirements

- **Performance**: Complete all checks within reasonable time (< 30s for 10 processes)
- **Dependencies**: Maintain zero external dependencies (Node.js 18+ native only)
- **File Format**: Human-readable and easily editable config format
- **Validation**: Clear error messages for config issues
- **Scalability**: Support 1-100 process IDs efficiently
- **Maintainability**: Minimal code changes to existing logic

### Constraints

- Must work with existing Node.js runtime (18+)
- No external dependencies (no npm packages)
- Must remain cron-compatible (single execution, exit with code)
- Config file must be simple to edit (no complex syntax)
- Must preserve existing error handling patterns

---

## Proposed Solutions

### Solution 1: JSON Configuration File

**Description**: Use JSON file for configuration with full schema validation.

**Configuration Format**:
```json
{
  "version": "1.0",
  "timeout": 10000,
  "processes": [
    {
      "id": "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc",
      "name": "Process Alpha",
      "enabled": true
    },
    {
      "id": "1234567890abcdefghijklmnopqrstuvwxyz1234567890AB",
      "name": "Process Beta",
      "enabled": true
    }
  ]
}
```

**Implementation Approach**:
```javascript
const fs = require('fs');
const configPath = process.env.CONFIG_FILE || './nonce-monitor.config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

for (const process of config.processes.filter(p => p.enabled)) {
  // Check each process
}
```

**Pros**:
- ✅ Native JSON.parse() - no dependencies
- ✅ Structured data with metadata (names, enabled flags)
- ✅ Easy schema validation
- ✅ Supports comments via preprocessor or documentation
- ✅ Can store additional metadata (names, descriptions, priorities)
- ✅ Machine-readable and parseable by other tools
- ✅ Familiar format for developers

**Cons**:
- ❌ JSON doesn't support comments natively
- ❌ Strict syntax (trailing commas cause errors)
- ❌ Quotes required for all strings (verbose)
- ❌ Less human-friendly for non-technical users
- ❌ Requires more complex structure for simple list

---

### Solution 2: Plain Text File (Line-Delimited)

**Description**: Simple text file with one process ID per line, optional comments.

**Configuration Format**:
```
# AO Network Process IDs to monitor
# Format: one process ID per line
# Lines starting with # are ignored

0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
1234567890abcdefghijklmnopqrstuvwxyz1234567890AB

# Process Charlie (currently disabled)
# abcdefghijklmnopqrstuvwxyz1234567890123456789012
```

**Implementation Approach**:
```javascript
const fs = require('fs');
const configPath = process.env.CONFIG_FILE || './process-ids.txt';
const content = fs.readFileSync(configPath, 'utf-8');
const processIds = content
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

for (const processId of processIds) {
  // Check each process
}
```

**Pros**:
- ✅ Extremely simple format (easiest to understand)
- ✅ Supports comments (# prefix)
- ✅ No quotes or syntax requirements
- ✅ Easy manual editing (vim, nano, notepad)
- ✅ Minimal parsing code (split + filter)
- ✅ Human-friendly for non-developers
- ✅ Git-friendly (easy diffs)
- ✅ Copy-paste friendly

**Cons**:
- ❌ No metadata support (names, descriptions)
- ❌ No individual process configuration (timeout, enabled flag)
- ❌ Less structured (harder to extend)
- ❌ No validation schema
- ❌ Can't disable processes without deleting/commenting

---

### Solution 3: Hybrid JSON with Simple Fallback

**Description**: Support both JSON (advanced) and plain text (simple) formats with automatic detection.

**Configuration Format (JSON)**:
```json
{
  "processes": [
    "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc",
    "1234567890abcdefghijklmnopqrstuvwxyz1234567890AB"
  ]
}
```

**Configuration Format (Plain Text)**:
```
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
1234567890abcdefghijklmnopqrstuvwxyz1234567890AB
```

**Implementation Approach**:
```javascript
const fs = require('fs');
const configPath = process.env.CONFIG_FILE || './process-ids.txt';
const content = fs.readFileSync(configPath, 'utf-8');

let processIds;
if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
  // JSON format
  const config = JSON.parse(content);
  processIds = Array.isArray(config) ? config : config.processes;
} else {
  // Plain text format
  processIds = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

for (const processId of processIds) {
  // Check each process
}
```

**Pros**:
- ✅ Flexibility - choose format based on needs
- ✅ Simple use case: plain text
- ✅ Advanced use case: JSON with metadata
- ✅ Automatic format detection
- ✅ Backward compatible with both approaches
- ✅ Easy migration path (start simple, upgrade to JSON)

**Cons**:
- ❌ More complex parsing logic
- ❌ Two code paths to maintain
- ❌ Format detection can fail edge cases
- ❌ Users might be confused about which format to use
- ❌ Testing requires covering both formats

---

## Solution Comparison Matrix

| Criteria | Solution 1 (JSON) | Solution 2 (Plain Text) | Solution 3 (Hybrid) |
|----------|-------------------|-------------------------|---------------------|
| **Simplicity** | Medium | High | Low |
| **Human-Friendly** | Medium | High | High |
| **Extensibility** | High | Low | High |
| **Parsing Complexity** | Low | Very Low | Medium |
| **Metadata Support** | Yes | No | Yes (JSON mode) |
| **Comment Support** | No (natively) | Yes | Yes (text mode) |
| **Validation** | Strong | Weak | Mixed |
| **Git-Friendly** | Medium | High | High |
| **Learning Curve** | Low | Very Low | Medium |
| **Future-Proof** | High | Low | High |
| **Error Messages** | Good | Basic | Good |
| **Code Complexity** | Low | Very Low | Medium |

---

## Recommended Solution

**Solution 2: Plain Text File (Line-Delimited)**

### Rationale

1. **Simplicity First**: For the primary use case (list of process IDs), plain text is the simplest and most accessible format
2. **Zero Learning Curve**: Anyone can edit a text file without understanding JSON syntax
3. **Easy Maintenance**: Add/remove process IDs by adding/removing lines
4. **Comment Support**: Built-in with `#` prefix for documentation
5. **Git-Friendly**: Line-based format shows clear diffs
6. **No Over-Engineering**: Current requirements don't need metadata or complex configuration
7. **Fast Parsing**: Minimal code, maximum performance
8. **Error-Resistant**: Hard to create syntax errors with plain text

### Trade-offs Accepted

- **Limited Metadata**: Can't store process names, descriptions, or flags
  - *Acceptable*: Process ID is self-identifying; names can be in comments
  
- **No Per-Process Config**: Can't set individual timeouts or enable/disable without commenting
  - *Acceptable*: Global timeout works for all processes; commenting is easy
  
- **Less Structured**: Harder to validate format
  - *Acceptable*: Process ID validation happens during execution; file format is trivial

### Migration Path

If future requirements need metadata or advanced features:
1. Keep plain text as default/primary format
2. Add optional JSON support with detection (upgrade to Solution 3)
3. Document migration guide in README

---

## Implementation Steps

### Phase 1: Configuration File Handling

**Step 1.1: Define Configuration File Structure**
- Create `process-ids.txt` in project root
- Format: one process ID per line
- Support `#` comments and blank lines
- Document format in README

**Step 1.2: Implement Configuration Loading**
- Add `loadConfig(filePath)` function
- Read file with `fs.readFileSync()`
- Parse lines (split, trim, filter)
- Validate: file exists, readable, non-empty list
- Default config path: `./process-ids.txt`
- Override via `CONFIG_FILE` env var or `--config` CLI arg

**Step 1.3: Error Handling**
- File not found: log error, exit 1
- Empty file: log warning, exit 1
- Invalid process IDs: log warning, continue with valid ones
- File read errors: log error with details, exit 1

### Phase 2: Multi-Process Execution

**Step 2.1: Refactor Single Process Logic**
- Extract `checkProcess(processId)` function from `main()`
- Returns: `{ processId, stateNonce, suRouterNonce, status, error }`
- Keep existing fetch and parse logic
- Individual timeout per process

**Step 2.2: Implement Sequential Execution**
- Loop through process IDs
- Execute `checkProcess()` for each
- Collect results array
- Continue on individual failures (don't exit early)
- Log each result immediately (real-time feedback)

**Step 2.3: Add Summary Reporting**
- Count: total, matches, mismatches, errors
- Log summary at end:
  ```
  === SUMMARY ===
  Total Processes: 5
  Matches: 3
  Mismatches: 1
  Errors: 1
  ```

### Phase 3: Logging Enhancements

**Step 3.1: Update Log Format**
- Add process ID to each log line
- Format: `[TIMESTAMP] [PROCESS_ID] State Nonce: X | SU Router Nonce: Y | Status: MATCH ✓`
- Truncate long process IDs (first 8 + last 8 chars)

**Step 3.2: Implement Result Tracking**
- Store results in array: `{ processId, stateNonce, suRouterNonce, match, error }`
- Use for summary generation
- Optional: export results to JSON file

### Phase 4: Backward Compatibility

**Step 4.1: Single Process Mode Fallback**
- If `CONFIG_FILE` not set and file doesn't exist:
  - Check for `PROCESS_ID` env var
  - If set, run single-process mode (existing behavior)
  - If not set, log error

**Step 4.2: CLI Argument Support**
- Add `--config <path>` argument parser
- Add `--process-id <id>` for single process override
- Add `--help` for usage information

### Phase 5: Testing & Validation

**Step 5.1: Update Test Suite**
- Test config file parsing (valid, invalid, empty)
- Test multi-process execution
- Test backward compatibility
- Test error scenarios

**Step 5.2: Create Example Config Files**
- `process-ids.example.txt` - template with comments
- `process-ids.txt` - actual config (gitignored)
- Document in README

**Step 5.3: Performance Testing**
- Test with 1, 10, 50, 100 process IDs
- Measure execution time
- Verify timeout behavior
- Check memory usage

### Phase 6: Documentation

**Step 6.1: Update README**
- Document config file format
- Provide examples
- Explain single vs. multi-process mode
- Update usage instructions

**Step 6.2: Update DEPLOYMENT.md**
- Add config file setup instructions
- Update cron examples
- Document log format changes

**Step 6.3: Update ARCHITECTURE.md**
- Document multi-process architecture
- Explain sequential execution choice
- Describe summary reporting

---

## Implementation Specifications

### Configuration File Format

**File:** `process-ids.txt`

**Syntax Rules:**
```
# Lines starting with # are comments
# Empty lines are ignored
# One process ID per line
# Leading/trailing whitespace is trimmed

# Production processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
1234567890abcdefghijklmnopqrstuvwxyz1234567890AB

# Staging processes
# abcd1234567890efghijklmnopqrstuvwxyz1234567890
```

**Validation:**
- Process ID must be non-empty string
- Process ID should match pattern: `^[a-zA-Z0-9_-]{43,64}$` (typical Arweave ID length)
- Warn on invalid IDs but continue with valid ones

### Configuration Loading Logic

```javascript
function loadConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const processIds = lines
    .map((line, index) => ({
      line: line.trim(),
      lineNumber: index + 1
    }))
    .filter(({ line }) => line && !line.startsWith('#'))
    .map(({ line, lineNumber }) => {
      // Optional: validate process ID format
      if (!isValidProcessId(line)) {
        console.warn(`[WARN] Invalid process ID at line ${lineNumber}: ${line}`);
        return null;
      }
      return line;
    })
    .filter(id => id !== null);
  
  if (processIds.length === 0) {
    throw new Error('No valid process IDs found in config file');
  }
  
  return processIds;
}
```

### Multi-Process Execution Logic

```javascript
async function checkAllProcesses(processIds) {
  const results = [];
  
  for (const processId of processIds) {
    try {
      const result = await checkProcess(processId);
      results.push(result);
      logResult(processId, result.stateNonce, result.suRouterNonce);
    } catch (error) {
      results.push({ processId, error: error.message });
      logError(processId, error.message);
    }
  }
  
  return results;
}

async function checkProcess(processId) {
  const stateUrl = `https://state.forward.computer/${processId}/compute/at-slot`;
  const suRouterUrl = `https://su-router.ao-testnet.xyz/${processId}/latest`;
  
  const [stateNonce, suRouterNonce] = await Promise.all([
    fetchStateNonce(stateUrl),
    fetchSURouterNonce(suRouterUrl)
  ]);
  
  return { processId, stateNonce, suRouterNonce };
}
```

### Summary Reporting Logic

```javascript
function generateSummary(results) {
  const total = results.length;
  const matches = results.filter(r => !r.error && r.stateNonce === r.suRouterNonce).length;
  const mismatches = results.filter(r => !r.error && r.stateNonce !== r.suRouterNonce).length;
  const errors = results.filter(r => r.error).length;
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total Processes: ${total}`);
  console.log(`Matches: ${matches} ✓`);
  console.log(`Mismatches: ${mismatches} ✗`);
  console.log(`Errors: ${errors} ⚠`);
  
  return { total, matches, mismatches, errors };
}
```

### Updated Log Format

**Single Process Mode (backward compatible):**
```
[2025-10-03T10:00:00.123Z] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
```

**Multi-Process Mode:**
```
[2025-10-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-10-03T10:00:01.456Z] [1234567890...567890AB] State Nonce: 2205626 | SU Router Nonce: 2205627 | Status: MISMATCH ✗
[2025-10-03T10:00:02.789Z] [abcd1234...34567890] ERROR: Failed to fetch state nonce

=== SUMMARY ===
Total Processes: 3
Matches: 1 ✓
Mismatches: 1 ✗
Errors: 1 ⚠
```

---

## Success Criteria

### Functional Success Criteria

- ✅ **Config File Reading**: Script successfully reads and parses `process-ids.txt`
- ✅ **Comment Support**: Lines starting with `#` are ignored
- ✅ **Blank Line Handling**: Empty lines are ignored
- ✅ **Multi-Process Execution**: All process IDs are checked
- ✅ **Individual Error Handling**: One process failure doesn't stop others
- ✅ **Per-Process Logging**: Each result logged with process ID
- ✅ **Summary Report**: Aggregate stats displayed at end
- ✅ **Backward Compatibility**: Single-process mode still works via env var
- ✅ **Config File Override**: `CONFIG_FILE` env var changes config path
- ✅ **Error Messages**: Clear errors for missing/invalid config

### Non-Functional Success Criteria

- ✅ **Performance**: 10 processes checked in < 15 seconds
- ✅ **Zero Dependencies**: No new npm packages added
- ✅ **File Size**: Script remains under 10KB
- ✅ **Memory Usage**: < 100MB for 100 processes
- ✅ **Exit Codes**: 0 (all success), 1 (any failure)
- ✅ **Log Clarity**: Easy to identify which process has issues

### Documentation Success Criteria

- ✅ **README Updated**: Config file format documented
- ✅ **Example Config**: `process-ids.example.txt` provided
- ✅ **Usage Examples**: Multi-process examples in README
- ✅ **Migration Guide**: How to upgrade from single to multi-process
- ✅ **Troubleshooting**: Common config issues documented

### Testing Success Criteria

- ✅ **Test Suite Updated**: Tests for config parsing and multi-process
- ✅ **Valid Config Test**: Successfully processes valid config file
- ✅ **Invalid Config Test**: Handles missing/empty/malformed config
- ✅ **Single Process Test**: Backward compatibility verified
- ✅ **Error Handling Test**: Individual failures handled gracefully
- ✅ **Performance Test**: 10+ processes complete in reasonable time

---

## Example Configuration Files

### Minimal Configuration
**File:** `process-ids.txt`
```
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
```

### Production Configuration
**File:** `process-ids.txt`
```
# AO Network Nonce Monitor - Process Configuration
# Format: one process ID per line
# Updated: 2025-10-03

# Production Processes
0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc
1234567890abcdefghijklmnopqrstuvwxyz1234567890AB
xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10

# Staging Processes
# abcd1234567890efghijklmnopqrstuvwxyz1234567890

# Development Processes (disabled)
# test1234567890abcdefghijklmnopqrstuvwxyz12345678
```

### Example Template
**File:** `process-ids.example.txt`
```
# AO Network Nonce Monitor - Process ID Configuration
#
# Instructions:
# 1. Copy this file to 'process-ids.txt'
# 2. Add your process IDs (one per line)
# 3. Lines starting with # are comments
# 4. Empty lines are ignored
#
# Example:
# 0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc

# Add your process IDs below:

```

---

## Expected Output Examples

### Successful Multi-Process Run
```bash
$ node nonce-monitor.js

[2025-10-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-10-03T10:00:01.456Z] [12345678...567890AB] State Nonce: 1500000 | SU Router Nonce: 1500000 | Status: MATCH ✓
[2025-10-03T10:00:02.789Z] [xU9zFkq3...QD6dh10] State Nonce: 3000000 | SU Router Nonce: 3000000 | Status: MATCH ✓

=== SUMMARY ===
Total Processes: 3
Matches: 3 ✓
Mismatches: 0 ✗
Errors: 0 ⚠
```

### Mixed Results Run
```bash
$ node nonce-monitor.js

[2025-10-03T10:00:00.123Z] [0syT13r0...ElLSrsc] State Nonce: 2205625 | SU Router Nonce: 2205625 | Status: MATCH ✓
[2025-10-03T10:00:01.456Z] [12345678...567890AB] State Nonce: 1500000 | SU Router Nonce: 1500001 | Status: MISMATCH ✗
[2025-10-03T10:00:02.789Z] [xU9zFkq3...QD6dh10] ERROR: Failed to fetch state nonce: HTTP 404: Not Found

=== SUMMARY ===
Total Processes: 3
Matches: 1 ✓
Mismatches: 1 ✗
Errors: 1 ⚠
```

### Config File Error
```bash
$ node nonce-monitor.js

[2025-10-03T10:00:00.123Z] ERROR: Config file not found: ./process-ids.txt

Hint: Create a process-ids.txt file with one process ID per line, or set PROCESS_ID environment variable for single-process mode.
```

---

## Migration & Rollout Plan

### Phase 1: Development (Week 1)
- Implement config file loading
- Refactor single-process logic into function
- Implement multi-process execution
- Add summary reporting
- Update log format

### Phase 2: Testing (Week 1)
- Update test suite
- Create example configs
- Test with 1, 10, 50 process IDs
- Validate backward compatibility
- Performance testing

### Phase 3: Documentation (Week 1)
- Update README with config format
- Update DEPLOYMENT.md
- Update ARCHITECTURE.md
- Create migration guide
- Update IMPLEMENTATION_NOTES.md

### Phase 4: Beta Release (Week 2)
- Deploy to test environment
- Monitor performance and errors
- Gather feedback
- Fix issues

### Phase 5: Production Release (Week 2)
- Deploy to production
- Monitor first 24 hours
- Document any issues
- Create troubleshooting guide

---

## Risks & Mitigation

### Risk 1: Performance Degradation
**Risk**: Checking 100 processes sequentially may take too long  
**Impact**: High - timeouts, cron overlap  
**Mitigation**: 
- Implement parallel execution (Promise.all with batching)
- Add configurable concurrency limit
- Document recommended max process count (50-100)

### Risk 2: Config File Errors
**Risk**: Users create invalid config files  
**Impact**: Medium - monitoring stops  
**Mitigation**:
- Robust parsing with clear error messages
- Validation with line numbers in errors
- Example config with documentation
- Fallback to single-process mode

### Risk 3: Breaking Changes
**Risk**: Existing deployments break  
**Impact**: High - production monitoring stops  
**Mitigation**:
- Maintain backward compatibility with env var mode
- Document migration clearly
- Provide example configs
- Version config file format

### Risk 4: Log Volume
**Risk**: 100 processes = 100 log lines per run  
**Impact**: Medium - log file growth  
**Mitigation**:
- Document log rotation setup for multi-process
- Add optional compact log format
- Consider log aggregation tools

---

## Future Enhancements

### Phase 2 Features (Post-Launch)
1. **Parallel Execution**: Process multiple IDs concurrently
2. **JSON Output**: Machine-readable results for integration
3. **Process Names**: Optional labels for process IDs
4. **Conditional Checks**: Enable/disable specific processes
5. **Priority Levels**: Check critical processes first

### Phase 3 Features (Long-term)
1. **JSON Config Support**: Advanced metadata and settings
2. **Per-Process Timeouts**: Different timeout per process
3. **Result Persistence**: Store results in database
4. **Alerting Rules**: Alert on N consecutive failures
5. **Health Dashboard**: Web UI for results

---

## Approval & Sign-Off

**Project Scope**: Approved ✅  
**Technical Approach**: Plain text config file (Solution 2) ✅  
**Implementation Plan**: 5 phases, ~1-2 weeks ✅  
**Success Criteria**: Defined and measurable ✅  
**Risk Mitigation**: Documented ✅

**Ready for Implementation**: ✅

---

**Document Version**: 1.0  
**Created**: October 3, 2025  
**Status**: Approved for Implementation  
**Estimated Effort**: 1-2 weeks (1 developer)  
**Dependencies**: None (extends existing nonce-monitor.js)
