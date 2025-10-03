# Slack Integration Setup Guide

This guide walks you through setting up Slack notifications for the AO process monitor.

## Prerequisites

- Admin access to your Slack workspace (or permission to install apps)
- Access to the `.env` file for this project

## Step-by-Step Setup

### 1. Create a Slack App

1. Navigate to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Select **"From scratch"**
4. Enter an app name (e.g., "AO Process Monitor")
5. Select your workspace
6. Click **"Create App"**

### 2. Enable Incoming Webhooks

1. In your app's settings, click **"Incoming Webhooks"** in the left sidebar (under "Features")
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down and click **"Add New Webhook to Workspace"**
4. Select the channel where you want notifications to appear (e.g., `#alerts`, `#ao-monitoring`)
5. Click **"Allow"**

### 3. Copy the Webhook URL

After authorizing, you'll see your webhook URL in the format:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**⚠️ Security Warning:** Treat this URL like a password. Anyone with this URL can post messages to your Slack channel.

### 4. Configure Environment Variable

Add the webhook URL to your `.env` file:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Optionally, enable error alerts:
```bash
SLACK_ALERT_ON_ERROR=true
```

**Note:** If `SLACK_ALERT_ON_ERROR` is not set or set to `false`, you'll only receive alerts for data mismatches. Set it to `true` to also receive alerts for network errors and other issues.

### 5. Test Your Webhook

Test the webhook using curl:

```bash
curl -X POST -H 'Content-type: application/json' \
--data '{"text":"🧪 Test message from AO Process Monitor"}' \
YOUR_WEBHOOK_URL
```

Replace `YOUR_WEBHOOK_URL` with your actual webhook URL.

You should see a test message appear in your selected Slack channel.

## Example Slack Messages

### Mismatch Alert
```
⚠️ AO Process Mismatch Detected

Process ID: abc123def456...
Expected CU: cu-1.example.com
Actual CU: cu-2.different.com

Timestamp: 2025-10-03T10:15:30.000Z
```

### Error Alert (if enabled)
```
🚨 AO Process Monitor Error

Process ID: abc123def456...
Error: Request timeout after 30000ms

Timestamp: 2025-10-03T10:15:30.000Z
```

### Multi-Process Alert
```
⚠️ AO Process Mismatch Detected

Multiple processes affected (3 total)

Process: abc123... - Expected: cu-1.example.com, Actual: cu-2.different.com
Process: def456... - Expected: cu-1.example.com, Actual: cu-3.another.com
Process: ghi789... - Expected: cu-1.example.com, Actual: cu-2.different.com

Timestamp: 2025-10-03T10:15:30.000Z
```

## Security Considerations

### Keep Your Webhook URL Secret

- ❌ **Never** commit your webhook URL to version control
- ❌ **Never** share it in public channels or forums
- ✅ **Use** environment variables (`.env` file)
- ✅ **Add** `.env` to `.gitignore`
- ✅ **Rotate** the webhook if it's ever exposed

### Rotating a Compromised Webhook

If your webhook URL is exposed:

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Select your app
3. Click **"Incoming Webhooks"**
4. Find the compromised webhook and click **"Remove"**
5. Add a new webhook following steps 2-4 above
6. Update your `.env` file with the new URL

## Troubleshooting

### Webhook Not Sending Messages

**Check your webhook URL:**
- Ensure the URL is correct in your `.env` file
- Verify there are no extra spaces or line breaks
- Test with curl (see step 5 above)

**Verify environment variables are loaded:**
```bash
# Check if variable is set (don't echo in production - it will expose the URL)
# Instead, check if it's defined:
node -e "require('dotenv').config(); console.log(process.env.SLACK_WEBHOOK_URL ? 'Set' : 'Not set')"
```

### Messages Not Appearing in Expected Channel

- The webhook is tied to a specific channel selected during setup
- To change channels, create a new webhook for the desired channel
- Or remove the old webhook and create a new one

### "invalid_payload" Error

- Check that your message format is valid JSON
- Ensure special characters are properly escaped
- Test with the basic curl command from step 5

### Rate Limiting

Slack webhooks have rate limits:
- ~1 message per second is generally safe
- If you hit rate limits, you'll receive a 429 status code
- The monitor implements basic throttling, but be aware of this limit

### No Alerts Appearing

- Check that `SLACK_WEBHOOK_URL` is set in your `.env` file
- If you only want mismatch alerts, ensure `SLACK_ALERT_ON_ERROR` is `false` or not set
- Verify the monitor is actually detecting issues (check console output)
- Test your webhook with curl to ensure it's working

## Advanced Configuration

### Custom Channel Overrides

To send different types of alerts to different channels, create multiple webhooks and modify the code to use different URLs based on alert type.

### Message Formatting

Slack supports rich message formatting using [Block Kit](https://api.slack.com/block-kit). The monitor uses simple text messages by default, but you can customize the message format in the source code.

## Support

For issues with:
- **Slack webhook setup**: See [Slack API documentation](https://api.slack.com/messaging/webhooks)
- **This monitor**: Check the main README.md or open an issue on the project repository
