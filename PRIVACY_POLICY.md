# Privacy Policy - Guardflow Extension

**Last Updated:** October 23, 2025

## Overview
Guardflow is a free browser extension that detects and prevents accidental secret leaks in AI chat interfaces. We take your privacy seriously.

## Data Collection & Storage
- **Zero Server Communication:** Guardflow processes all data locally on your device. We do NOT send any information to external servers.
- **Local-Only Detection:** Secret detection runs entirely within your browser using regex patterns.
- **No User Tracking:** We do not track your activity, chat content, or browsing behavior.
- **No Third-Party Sharing:** Your data is never shared with third parties.

## What Data We Store
Guardflow stores only local extension statistics in your browser:
- Number of secrets detected
- Number of secrets blocked
- Number of messages sent

This data is stored locally using Chrome's `chrome.storage.local` API and never leaves your device.

## Permissions Explained
- **storage:** To save your local statistics (secrets detected, blocked, messages sent)
- **activeTab:** To detect which AI platform you're using and inject secret detection

## Message Content
The full text of your messages is processed locally in real-time to detect secrets, but:
- We do NOT store message content
- We do NOT send messages to any server
- Messages are analyzed only for secret patterns and immediately discarded

## What We Detect
Guardflow detects common secret patterns including:
- API keys (AWS, Stripe, SendGrid, GitHub, NPM, etc.)
- Database credentials (PostgreSQL, MongoDB, Redis, MySQL)
- Private keys (SSH, PEM)
- Authentication tokens (JWT, Slack, Discord)
- OAuth tokens
- Webhooks URLs

## Third-Party Services
Guardflow does not integrate with any third-party services or analytics platforms.

## Changes to This Policy
We may update this policy occasionally. We'll notify users via extension updates.

## Contact
For privacy questions, contact: deepakk5893@gmail.com

## Important Note
This extension is provided as-is for security awareness. Always review your messages for sensitive information before sending to AI services, regardless of this tool's detection capabilities.
