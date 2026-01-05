# Privacy Policy - Niyantra Extension

**Last Updated:** January 5, 2026

## Overview
Niyantra is a browser extension that detects and prevents accidental leaks of secrets and sensitive data (PII) in AI chat interfaces like ChatGPT, Claude, Gemini, Perplexity, and Grok. We take your privacy seriously.

## Operating Modes

Niyantra operates in two modes:

### 1. Local-Only Mode (Default)
By default, Niyantra processes all data **locally on your device**:
- Secret detection runs entirely within your browser using regex patterns
- **No data is sent to any external server**
- No internet connection required for detection
- This is the default mode when no server is configured

### 2. Enterprise Server Mode (Optional)
When you configure an enterprise server URL and API key in settings:
- Message text may be sent to your organization's Niyantra server for enhanced scanning
- File attachments may be sent for OCR and PII detection
- The server returns detection results and optionally redacted versions
- **Only your organization's server receives this data** - not Niyantra or any third party

## Data Collection & Storage

### Local Storage Only
Niyantra stores only statistical counters in your browser using `chrome.storage.local`:
- Number of secrets/PII detected
- Number of submissions blocked
- Number of messages sent
- Server configuration (URL and API key, if configured)

**This data never leaves your device** unless you configure enterprise server mode.

### What We Do NOT Store
- Message content (analyzed in real-time, immediately discarded)
- Detected secrets or PII values
- Chat history or conversation content
- Browsing history or activity

## Data Transmission (Enterprise Mode Only)

When enterprise server mode is enabled, the following may be transmitted to your configured server:

| Data | When Sent | Purpose |
|------|-----------|---------|
| Message text | When you send a message | PII/secret scanning |
| File content (base64) | When you attach files | Document scanning |
| Statistics (counts only) | Every 5 minutes | Usage monitoring |
| Override events | When you click "Send Anyway" | Audit logging |

**Important:** This data is sent ONLY to the server URL you configure, which should be your organization's own Niyantra backend. We (Niyantra developers) do not receive or have access to this data.

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `storage` | Save local statistics and settings |
| `activeTab` | Detect which AI platform you're using |
| `alarms` | Schedule heartbeat pings to enterprise server (if configured) |
| Host permissions (AI sites) | Inject content script to intercept messages before sending |

## What We Detect

Niyantra detects 50+ secret patterns including:
- **API Keys:** OpenAI, Anthropic, AWS, Google, GitHub, Stripe, etc.
- **Database Credentials:** PostgreSQL, MongoDB, Redis, MySQL connection strings
- **Private Keys:** SSH, PEM, RSA keys
- **Authentication:** JWT tokens, OAuth tokens, passwords
- **Personal Data (PII):** Email, phone, Aadhaar, PAN, credit cards (with enterprise server)

## Third-Party Services

- **Local Mode:** No third-party services are contacted
- **Enterprise Mode:** Only your organization's configured server is contacted

We do not integrate with any analytics, advertising, or tracking platforms.

## Data Security

- All server communication uses HTTPS encryption
- API keys are stored locally in browser storage (not accessible to websites)
- No data is transmitted without explicit user configuration
- Enterprise servers should be hosted within your organization's infrastructure

## User Rights

You can:
- Use the extension in local-only mode with zero data transmission
- Clear all stored data by removing the extension
- Disable the extension for specific sites
- View all stored data via browser developer tools

## Children's Privacy

This extension is intended for professional use and does not knowingly collect data from children under 13.

## Changes to This Policy

We may update this policy when adding features. Changes will be communicated via extension updates. Continued use after updates constitutes acceptance.

## Contact

For privacy questions or data requests, contact: deepakk5893@gmail.com

## Important Note

This extension is provided as-is for security awareness. Always review your messages for sensitive information before sending to AI services, regardless of this tool's detection capabilities.
