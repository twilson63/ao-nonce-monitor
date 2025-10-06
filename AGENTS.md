# Agent Guidelines for AO Nonce Monitor

## Build/Test Commands
- **Run main monitor**: `node nonce-monitor.js` or `npm start`
- **Run tests**: `node test-monitor.js` or `npm test`
- **Test PagerDuty**: `node test-pagerduty.js`
- **Run single test**: Tests are self-contained - run individual test files directly

## Code Style Guidelines

### JavaScript Patterns
- **Node.js 18+**: Use native fetch API, no external dependencies
- **Error handling**: Always use try-catch, provide descriptive error messages
- **Logging**: ISO 8601 timestamps with `[timestamp] [process] message` format
- **Exit codes**: 0 for success, 1 for errors/mismatches

### Function Naming
- **camelCase**: `getTimestamp()`, `truncateProcessId()`, `sendSlackAlert()`
- **Descriptive verbs**: `loadConfig()`, `fetchStateNonce()`, `buildSlackMessage()`
- **Async prefix**: `async/await` for network operations

### Environment Variables
- **Uppercase with underscores**: `PROCESS_ID`, `SLACK_WEBHOOK_URL`
- **Defaults**: Provide sensible defaults with `||` operator
- **Parsing**: Use `parseInt()` for numbers, `=== 'true'` for booleans

### Error Messages
- **Specific**: Include process ID, endpoint, timeout details
- **Timestamped**: All errors include ISO timestamp
- **Actionable**: Suggest solutions (increase timeout, check config, etc.)

### Code Structure
- **Modular**: Separate lib files for complex features (pagerduty.js)
- **Pure functions**: Avoid side effects in utility functions
- **Early returns**: Validate inputs and return early
- **Consistent formatting**: 2-space indentation, single quotes for strings