#!/bin/bash

set -e

echo "========================================"
echo "  GitHub Secrets Setup - Nonce Monitor  "
echo "========================================"
echo ""

if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo ""
    echo "Installation instructions:"
    echo "  macOS:   brew install gh"
    echo "  Linux:   See https://github.com/cli/cli#installation"
    echo "  Windows: See https://github.com/cli/cli#installation"
    echo ""
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI."
    echo ""
    echo "Please run: gh auth login"
    echo ""
    exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo "Error: Not in a GitHub repository or repository not found."
    echo ""
    echo "Please run this script from within your repository directory."
    echo ""
    exit 1
fi

echo "Configuring secrets for repository: $REPO"
echo ""
echo "Note: Secret values will not be echoed to the terminal."
echo ""

echo "----------------------------------------"
echo "Required Secrets"
echo "----------------------------------------"
echo ""

read -p "Enter PROCESS_ID (required): " process_id
if [ -z "$process_id" ]; then
    echo "Error: PROCESS_ID is required."
    exit 1
fi

echo "Setting PROCESS_ID..."
echo "$process_id" | gh secret set PROCESS_ID
echo "✓ PROCESS_ID set successfully"
echo ""

echo "----------------------------------------"
echo "Optional Secrets"
echo "----------------------------------------"
echo ""

read -p "Enter SLACK_WEBHOOK_URL (optional, press Enter to skip): " slack_webhook
if [ -n "$slack_webhook" ]; then
    echo "Setting SLACK_WEBHOOK_URL..."
    echo "$slack_webhook" | gh secret set SLACK_WEBHOOK_URL
    echo "✓ SLACK_WEBHOOK_URL set successfully"
else
    echo "⊘ SLACK_WEBHOOK_URL skipped (Slack notifications will be disabled)"
fi
echo ""

read -p "Enter REQUEST_TIMEOUT in seconds (optional, press Enter for default 30s): " request_timeout
if [ -n "$request_timeout" ]; then
    if ! [[ "$request_timeout" =~ ^[0-9]+$ ]]; then
        echo "Error: REQUEST_TIMEOUT must be a number."
        exit 1
    fi
    echo "Setting REQUEST_TIMEOUT..."
    echo "$request_timeout" | gh secret set REQUEST_TIMEOUT
    echo "✓ REQUEST_TIMEOUT set to ${request_timeout}s"
else
    echo "⊘ REQUEST_TIMEOUT skipped (will use default 30s)"
fi
echo ""

echo "========================================"
echo "  Configuration Complete!               "
echo "========================================"
echo ""
echo "Configured secrets:"
gh secret list
echo ""
echo "Next steps:"
echo "  1. Review secrets in GitHub UI: https://github.com/$REPO/settings/secrets/actions"
echo "  2. Test the workflow: gh workflow run monitor-nonce.yml"
echo "  3. View workflow runs: gh run list --workflow=monitor-nonce.yml"
echo ""
echo "For more information, see .github/secrets.template.md"
echo ""
