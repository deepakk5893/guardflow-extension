# Niyantra Extension Architecture

## Overview

Niyantra is a browser extension that provides real-time PII/secret detection for AI chat platforms. It intercepts user messages and file uploads before they're sent to AI services, scanning them via a Niyantra backend server.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Chat Website                          │
│                     (chatgpt.com, claude.ai, etc.)             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │  Content Script         │
                    │  - Message interception │
                    │  - File interception    │
                    │  - UI dialogs          │
                    └────────────┬────────────┘
                                 │ chrome.runtime.sendMessage()
                                 ▼
                    ┌────────────────────────┐
                    │  Background Script     │
                    │  - HTTP proxy          │
                    │  - Settings sync       │
                    │  - Heartbeat          │
                    └────────────┬───────────┘
                                 │ fetch()
                                 ▼
                    ┌────────────────────────┐
                    │   Niyantra Backend     │
                    │   - PII detection      │
                    │   - Secret scanning    │
                    │   - Auto-redaction     │
                    └────────────────────────┘
```

## Component Details

### 1. Content Script (`src/content/content.ts`)

**Purpose:** Runs in the context of AI chat pages, intercepts user interactions.

**Responsibilities:**
- Intercept message submissions (Enter key, Send button)
- Extract message text from platform-specific elements
- Request scanning via background script
- Display warning dialogs when violations detected
- Handle redacted message submission

**Key Features:**
- Platform-specific selectors (ChatGPT, Claude, Gemini, etc.)
- Dual interception: keyboard events AND button clicks
- State management to prevent double-scanning
- Local fallback when server unavailable

**Message Flow:**
```typescript
// 1. User presses Enter or clicks Send
handleGlobalEnterKey(event) / attachSubmitHandler(button)

// 2. Extract message text
const messageText = config.getMessageText(textarea)

// 3. Scan via background script (NOT direct fetch)
const result = await performScan(messageText, platform)
  └─> apiClient.scanMessage()
      └─> chrome.runtime.sendMessage({ type: 'API_REQUEST', ... })

// 4. Show dialog if violations found
const { action, redactedText } = await handleScanResult(result)

// 5. Allow or block submission
if (action === 'allow') {
  submitButton.click()
}
```

### 2. API Client (`src/content/api-client.ts`)

**Purpose:** Abstraction layer for server communication (via background script).

**Architecture Change (Important!):**
- ❌ **OLD:** Content script made direct `fetch()` calls to localhost
- ✅ **NEW:** Content script sends messages to background, which makes `fetch()` calls

**Why the change?**
Chrome's Private Network Access (PNA) policy blocks content scripts from accessing localhost when running on public websites (chatgpt.com). Background scripts don't have this restriction.

**Key Methods:**
```typescript
// All methods use message passing instead of direct fetch
async scanMessage(text, platform): Promise<ScanMessageResponse>
  └─> chrome.runtime.sendMessage({ type: 'API_REQUEST', endpoint: '/scan-message' })

async scanFile(document, mimeType, filename, platform): Promise<ScanFileResponse>
  └─> chrome.runtime.sendMessage({ type: 'API_REQUEST', endpoint: '/scan-file' })

async fetchConfig(): Promise<ExtensionConfig>
  └─> chrome.runtime.sendMessage({ type: 'API_REQUEST', endpoint: '/config' })
```

### 3. Background Script (`src/background/background.ts`)

**Purpose:** Service worker that handles extension lifecycle and acts as HTTP proxy.

**Responsibilities:**
1. **HTTP Proxy** - Makes actual fetch() requests to backend (bypasses PNA)
2. **Heartbeat** - Sends periodic health checks to server (every 5 min)
3. **Config Sync** - Fetches and caches server configuration
4. **Settings Broadcast** - Notifies all tabs when settings change

**Message Handler:**
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    // Proxy HTTP request to backend
    const url = `${serverUrl}${message.endpoint}`
    const response = await fetch(url, {
      method: message.method,
      headers: { 'X-API-Key': apiKey, ... },
      body: JSON.stringify(message.body)
    })
    sendResponse({ data: await response.json() })
  }
})
```

**Heartbeat Flow:**
```typescript
// On install/startup:
startHeartbeatTimer()
  └─> chrome.alarms.create('niyantra-heartbeat', { periodInMinutes: 5 })

// Every 5 minutes:
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'niyantra-heartbeat') {
    sendHeartbeat()
      └─> fetch('/api/v1/extension/heartbeat', {
            body: { extension_version, browser, stats }
          })
  }
})
```

### 4. File Interceptor (`src/content/file-interceptor.ts`)

**Purpose:** Intercepts file uploads and scans them before attachment.

**Interception Points:**
1. **File Input Change** - Intercepts `<input type="file">` changes
2. **Drag & Drop** - Intercepts drop events on composer areas

**Supported File Types:**
- PDF documents (with OCR)
- Word docs (DOCX, DOC)
- Images (PNG, JPG, GIF, WEBP) - OCR extracted
- Text files (TXT, CSV, JSON)
- Spreadsheets (XLSX, XLS)

**File Scanning Flow:**
```typescript
// 1. User selects file
input.addEventListener('change', async (event) => {
  const files = input.files

  // 2. Scan each file
  for (const file of files) {
    const base64 = await fileToBase64(file)
    const result = await scanFile(file, platform)
      └─> apiClient.scanFile(base64, mimeType, filename, platform)
          └─> chrome.runtime.sendMessage({ type: 'API_REQUEST', endpoint: '/scan-file' })

    // 3. Show dialog if violations
    if (result.has_violations) {
      const choice = await showFileViolationDialog(file, detections)
      if (choice === 'cancel' || choice === 'edit') {
        // Block file upload
        input.value = ''
        return
      }
    }
  }

  // 4. Allow only approved files
  const dt = new DataTransfer()
  allowedFiles.forEach(f => dt.items.add(f))
  input.files = dt.files
})
```

### 5. Dialog System (`src/content/dialog.ts`)

**Purpose:** Display warning dialogs when violations detected.

**Dialog Types:**
1. **Scanning Overlay** - Shows "Scanning..." during server request
2. **Enhanced Warning Dialog** - Shows detected violations with options

**Dialog Actions:**
- **Edit Message** - Returns focus to textarea, blocks submission
- **Cancel** - Closes dialog, blocks submission
- **Send Redacted** - Submits auto-redacted version (if available)

**No "Send Anyway" option** - Violations are always blocked or redacted, regardless of user role.

### 6. Popup (`src/popup/Popup.tsx`)

**Purpose:** Extension settings UI.

**Features:**
- Server URL configuration
- API key input
- Connection status indicator
- Scan mode toggle (Local/Server/Hybrid)

**Settings Update Flow:**
```typescript
const saveSettings = async () => {
  // 1. Save to storage
  await chrome.storage.local.set({ serverUrl, apiKey, scanMode })

  // 2. Notify background script
  await chrome.runtime.sendMessage({
    type: 'SETTINGS_UPDATED',
    serverUrl, apiKey, scanMode
  })
    └─> Background broadcasts to all tabs
        └─> Content scripts update apiClient settings
}
```

## Data Flow Diagrams

### Message Scanning Flow

```
User Types Message
       │
       ▼
┌──────────────────┐
│  Content Script  │ Intercept Enter/Click
└────────┬─────────┘
         │ Extract text
         ▼
┌──────────────────┐
│   API Client     │ chrome.runtime.sendMessage()
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Background Script│ fetch() to localhost:8000
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Niyantra Backend │ Regex + GLiNER detection
└────────┬─────────┘
         │
         ▼
     Response
    { has_violations: true,
      detections: [...],
      redacted_text: "..." }
         │
         ▼
┌──────────────────┐
│  Dialog System   │ Show warning with options
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
  Edit     Send Redacted
 (Block)   (Replace & Send)
```

### File Scanning Flow

```
User Uploads File
       │
       ▼
┌──────────────────┐
│ File Interceptor │ Intercept input/drop
└────────┬─────────┘
         │ Convert to base64
         ▼
┌──────────────────┐
│   API Client     │ chrome.runtime.sendMessage()
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Background Script│ fetch() to localhost:8000
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Niyantra Backend │ OCR + PII detection
└────────┬─────────┘
         │
         ▼
     Response
    { has_violations: true,
      detections: [...],
      extracted_text: "..." }
         │
         ▼
┌──────────────────┐
│  Dialog System   │ Show file violation dialog
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
  Cancel    Edit
 (Block)   (Block)
```

## Security Considerations

### Private Network Access (PNA)

**Problem:** Chrome blocks content scripts from accessing localhost when running on public websites.

**Solution:** Background script acts as HTTP proxy:
- Content scripts send messages via `chrome.runtime.sendMessage()`
- Background script makes actual `fetch()` calls
- Background scripts are not subject to PNA restrictions

### API Key Storage

- Stored in `chrome.storage.local` (encrypted by Chrome)
- Never exposed to page context
- Only accessible by extension components
- Transmitted via `X-API-Key` header (HTTPS only in production)

### Message Sanitization

- Message text is hashed (SHA-256) before logging
- Only first 32 chars of hash logged
- Full text never persisted on backend
- Redacted text replaces sensitive data with `[REDACTED_TYPE]`

## Extension Permissions

```json
{
  "permissions": [
    "storage",      // Save settings and stats
    "activeTab",    // Access current tab
    "alarms"        // Heartbeat timer
  ],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://www.perplexity.ai/*",
    "https://chat.groq.com/*",
    "https://*.niyantra.com/*",
    "http://localhost:8000/*",      // Development
    "http://127.0.0.1:8000/*"       // Development
  ]
}
```

## Build System

### Multi-Browser Support

```
guardflow-extension/
├── src/                    # Shared source code
├── browsers/
│   ├── chrome/
│   │   ├── manifest.json   # Manifest V3
│   │   └── vite.config.ts
│   └── firefox/
│       ├── manifest.json   # Manifest V2
│       └── vite.config.ts
└── dist-chrome/           # Build output
└── dist-firefox/          # Build output
```

### Build Commands

```bash
# Chrome
cd browsers/chrome && tsc && vite build
# Output: dist-chrome/

# Firefox
cd browsers/firefox && tsc && vite build
# Output: dist-firefox/
```

## Performance Optimizations

1. **Local-First Fallback** - If server unavailable, falls back to local regex
2. **Hybrid Scanning** - Local regex first (fast), then server (thorough)
3. **Scan Result Caching** - Content scripts cache API client config
4. **Async Message Passing** - Non-blocking communication with background
5. **MutationObserver** - Efficient DOM monitoring for dynamic elements

## Error Handling

### Network Errors
- Server timeout → Fallback to local scanning
- Connection refused → Fallback to local scanning
- Invalid API key → Show error in popup

### File Errors
- File too large → Show error dialog
- Unsupported type → Allow through (don't block)
- OCR failure → Allow through with warning

### Extension Errors
- Content script injection failed → Extension doesn't run on page
- Background script crash → Chrome auto-restarts service worker
- Storage quota exceeded → Clear old stats

## Future Enhancements

1. **Offline Mode** - Bundle local PII/secret patterns for offline scanning
2. **Custom Rules** - Allow enterprises to add custom detection patterns
3. **Audit Logs** - Per-user activity tracking with compliance reports
4. **Smart Redaction** - ML-powered context-aware redaction
5. **Multi-Language Support** - i18n for dialog messages
