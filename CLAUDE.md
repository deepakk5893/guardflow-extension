# Niyantra Browser Extension - Claude Code Instructions

## Project Overview

Browser extension for PII detection and Shadow AI monitoring on AI chat platforms (ChatGPT, Claude, Gemini, Perplexity, Grok).

**Main Niyantra repo:** `/Users/deepakkhandelwal/Desktop/Projects/Niyantra`

---

## Documentation Requirements

**IMPORTANT: After implementing extension features, update BOTH documentation files:**

| File | Location | What to Document |
|------|----------|------------------|
| `docs/extension/ARCHITECTURE.md` | This repo | Full technical details |
| `docs/extension/ARCHITECTURE.md` | Main Niyantra repo (`/Users/deepakkhandelwal/Desktop/Projects/Niyantra/docs/extension/`) | Keep in sync with above |
| `docs/PROJECT_UNDERSTANDING.md` | Main Niyantra repo | High-level overview under "Browser Extension" section |
| `docs/FEATURES.md` | Main Niyantra repo | If adding major feature, create new section |

### Documentation Checklist for Extension Features

1. **Architecture changes** → Update `docs/extension/ARCHITECTURE.md` (both repos)
2. **New message types** → Document in Background Script section
3. **New permissions** → Update Extension Permissions section
4. **New platform support** → Update Supported Platforms table
5. **Enterprise/SSO changes** → Update Enterprise Auth Module section

---

## Project Structure

```
guardflow-extension/
├── src/
│   ├── content/           # Content scripts (runs on AI chat pages)
│   │   ├── content.ts     # Main message interception
│   │   ├── api-client.ts  # Server communication
│   │   ├── file-interceptor.ts
│   │   ├── dialog.ts      # Warning dialogs
│   │   └── site-configs.ts
│   ├── background/        # Service worker
│   │   └── background.ts  # HTTP proxy, heartbeat, message handlers
│   ├── popup/             # Extension popup UI
│   │   ├── Popup.tsx
│   │   └── Popup.css
│   ├── auth/              # Enterprise authentication
│   │   └── enterprise-auth.ts
│   ├── shadow-ai/         # Shadow AI detection
│   │   ├── shadow-ai-manager.ts
│   │   └── shadow-ai-banner.ts
│   └── blocked/           # Block page for Shadow AI
├── browsers/
│   ├── chrome/
│   │   ├── manifest.json
│   │   └── managed_schema.json
│   └── firefox/
│       └── manifest.json
└── docs/
    └── extension/
        └── ARCHITECTURE.md
```

---

## Key Patterns

### Message Passing (Content → Background)
```typescript
// Content script
const response = await chrome.runtime.sendMessage({
  type: 'API_REQUEST',
  endpoint: '/api/v1/extension/scan-message',
  method: 'POST',
  body: { text, platform }
});

// Background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    // Make actual fetch() call
    sendResponse({ data: ... });
  }
  return true; // Keep channel open for async response
});
```

### Enterprise Auth Flow
```typescript
// 1. Check managed policy
const policy = await getManagedPolicy(); // chrome.storage.managed

// 2. If policy exists, authenticate
if (policy?.tenantToken) {
  const auth = await authenticateWithTenantToken(policy.serverUrl, policy.tenantToken);
  if (auth.sso_enabled) {
    // Need SSO login
  }
}

// 3. SSO login via chrome.identity
const token = await chrome.identity.getAuthToken({ interactive: true });
const result = await authenticateWithGoogleSSO(serverUrl, tenantToken, token);
```

### Enforcement Modes
```typescript
// Check mode before blocking
if (apiClient.isLogOnlyMode()) {
  apiClient.logMessage(text, platform);  // Fire-and-forget
  return;  // Allow through immediately
}

// enforce mode - block and scan
event.preventDefault();
const result = await apiClient.scanMessage(text, platform);
// Show dialog if violations...
```

---

## Adding New AI Platform Support

1. **Add site config** in `src/content/site-configs.ts`:
```typescript
{
  name: 'newplatform',
  urlPatterns: ['https://newplatform.ai/*'],
  textareaSelector: '.chat-input',
  submitButtonSelector: 'button[type="submit"]',
  getMessageText: (textarea) => textarea.value,
  setMessageText: (textarea, text) => { textarea.value = text; },
}
```

2. **Add URL to manifest** in `browsers/chrome/manifest.json`:
```json
"content_scripts": [{
  "matches": [
    "https://newplatform.ai/*"
  ]
}]
```

3. **Document** in `docs/extension/ARCHITECTURE.md` Supported Platforms section

---

## Adding New Message Handler

1. **Add handler** in `src/background/background.ts`:
```typescript
if (message.type === 'NEW_MESSAGE_TYPE') {
  (async () => {
    try {
      // Handle message
      sendResponse({ success: true, data: ... });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep channel open
}
```

2. **Document** the message type in `docs/extension/ARCHITECTURE.md`

---

## Build Commands

```bash
# Development (with watch)
npm run dev:chrome

# Production build
npm run build:chrome
npm run build:firefox

# Output directories
# Chrome: dist-chrome/
# Firefox: dist-firefox/
```

---

## Testing

### Manual Testing Checklist

- [ ] Message interception on ChatGPT
- [ ] Message interception on Claude
- [ ] Message interception on Gemini
- [ ] File upload blocking
- [ ] Shadow AI detection (warn/block)
- [ ] Enterprise Chrome policy (if applicable)
- [ ] SSO login flow (if applicable)
- [ ] Log-only mode (no blocking)
- [ ] Enforce mode (blocking dialogs)

### Load Extension in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist-chrome/` folder

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Content script not running | Check manifest URL patterns |
| Network request blocked | Use background script for fetch (PNA) |
| SSO popup closes | Verify oauth2 client_id in manifest |
| Managed policy not reading | Check chrome.storage.managed permissions |
| Dialog not showing | Check CSS injection, z-index conflicts |

---

## Important Reminders

1. **Message passing for network requests** - Content scripts can't access localhost directly (Chrome PNA)
2. **Keep both ARCHITECTURE.md files in sync** - This repo and main Niyantra repo
3. **Test all platforms** - ChatGPT, Claude, Gemini, Perplexity, Grok
4. **Test both enforcement modes** - enforce AND log_only
5. **Consider enterprise scenarios** - Chrome policy, SSO, auto-provisioning
