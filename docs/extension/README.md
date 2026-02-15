# Niyantra Browser Extension Documentation

## Quick Start

Niyantra is a browser extension that protects sensitive data by detecting and blocking PII, secrets, and credentials before they're sent to AI chat platforms like ChatGPT, Claude, and Gemini.

## Documentation Index

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete technical architecture and data flow diagrams
- This README - Overview and quick reference

## How It Works

```
User types message → Extension intercepts → Scans for secrets/PII → Shows warning → Blocks or redacts
```

### Architecture Overview

The extension uses a **message-passing architecture** to bypass Chrome's Private Network Access restrictions:

1. **Content Script** (runs on AI chat pages)
   - Intercepts messages and file uploads
   - Sends scan requests to background script
   - Displays warning dialogs

2. **Background Script** (service worker)
   - Acts as HTTP proxy to Niyantra backend
   - Makes fetch() calls to localhost:8000
   - Broadcasts settings updates to all tabs

3. **Niyantra Backend** (FastAPI server)
   - Performs PII/secret detection with GLiNER
   - Generates auto-redacted versions
   - Returns violations and redacted text

### Why Message Passing?

Chrome blocks content scripts from accessing `localhost` when running on public websites (chatgpt.com) due to Private Network Access (PNA) policy. Background scripts don't have this restriction, so we use them as an HTTP proxy.

## Key Features

### Message Scanning
- Real-time detection before submission
- Regex + ML-based detection (GLiNER)
- Auto-redaction with `[REDACTED_TYPE]` placeholders
- No "Send Anyway" option - violations are blocked

### File Scanning
- Supports: PDF, DOCX, Images, TXT, CSV, JSON, XLSX
- OCR for PDFs and images
- Scans before attachment
- Blocks files with violations

### Supported Platforms
- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Perplexity (perplexity.ai)
- Groq (groq.com)

## Installation

### For Users

1. Load extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist-chrome` folder

2. Configure settings:
   - Click extension icon
   - Enter server URL: `http://localhost:8000`
   - Enter your API key
   - Click "Save Settings"

3. Test on ChatGPT:
   - Go to chatgpt.com
   - Type a message with a secret (e.g., "My API key is AKIAIOSFODNN7EXAMPLE")
   - Press Enter - dialog should appear

### For Developers

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build extension:
   ```bash
   npm run build
   ```

3. Build outputs to:
   - Chrome: `dist-chrome/`
   - Firefox: `dist-firefox/`

## Configuration

### Extension Settings

- **Server URL**: Niyantra backend URL (e.g., `http://localhost:8000`)
- **API Key**: User-specific extension API key
- **Scan Mode**:
  - `local` - Fast regex-only scanning (offline)
  - `server` - Full server-side scanning with ML
  - `hybrid` - Local first, then server (recommended)

### Backend Setup

See [Niyantra backend docs](https://github.com/niyantra/backend) for:
- Database setup
- API key generation
- Compliance rule configuration

## API Endpoints Used

All requests proxied through background script:

- `POST /api/v1/extension/scan-message` - Scan text
- `POST /api/v1/extension/scan-file` - Scan file
- `GET /api/v1/extension/config` - Fetch config
- `POST /api/v1/extension/heartbeat` - Health monitoring
- `POST /api/v1/extension/validate-key` - Validate API key

## Troubleshooting

### Extension Not Working

1. Check console errors:
   - Open DevTools (F12)
   - Look for `[Niyantra]` logs

2. Verify backend connection:
   - Check extension popup shows "Connected"
   - Test: `curl http://localhost:8000/health`

3. Reload extension:
   - Go to `chrome://extensions`
   - Click reload icon

### CORS Errors

If you see CORS errors, ensure:
- Backend is running on `localhost:8000`
- Extension is using background script as proxy (v2.0.0+)
- Not making direct fetch() calls from content script

### File Upload Not Intercepting

1. Check platform config in `src/content/site-configs.ts`
2. Verify file input selector is correct
3. Check browser console for initialization errors

## Development

### Project Structure

```
src/
├── background/
│   └── background.ts       # Service worker (HTTP proxy)
├── content/
│   ├── content.ts          # Main content script
│   ├── api-client.ts       # Server communication (via background)
│   ├── file-interceptor.ts # File upload interception
│   ├── dialog.ts           # Warning dialogs
│   └── site-configs.ts     # Platform-specific selectors
├── popup/
│   └── Popup.tsx           # Settings UI
└── utils/
    └── secretDetection.ts  # Local regex patterns
```

### Adding a New Platform

1. Add to `src/content/site-configs.ts`:
   ```typescript
   {
     name: 'NewPlatform',
     pattern: /newplatform\.com/,
     textarea: '.chat-input',
     submitButton: 'button[type="submit"]',
     getMessageText: (el) => el.textContent
   }
   ```

2. Add to `manifest.json` host_permissions:
   ```json
   "https://newplatform.com/*"
   ```

3. Rebuild and test

### Running Tests

```bash
# Unit tests
npm test

# E2E tests (requires backend running)
npm run test:e2e
```

## Security

- API keys stored in `chrome.storage.local` (Chrome-encrypted)
- Message text hashed before logging
- HTTPS required in production
- No message content persisted
- Background script enforces authentication

## Performance

- Hybrid mode: ~50-200ms latency
- Local mode: <10ms latency
- Server mode: ~100-500ms latency (depends on ML model)
- File scanning: ~500-2000ms (OCR + detection)

## Version History

### v2.0.0 (Current)
- ✅ Message-passing architecture (fixes PNA issues)
- ✅ File upload interception with OCR
- ✅ Hybrid scanning mode
- ✅ Auto-redaction support

### v1.0.3
- ❌ Direct fetch from content script (PNA blocked)
- Local regex scanning only
- No file interception

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for:
- Code style guide
- Pull request process
- Testing requirements

## License

See [LICENSE](../../LICENSE)

## Support

- Report issues: GitHub Issues
- Questions: [Niyantra Slack]
- Security: admin@guardflow.tech
