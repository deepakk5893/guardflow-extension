# Build Guide - Multi-Browser Support

GuardFlow now supports multiple browsers with a shared codebase!

## Project Structure

```
guardflow-extension/
├── src/                          # SHARED CODE (all browsers)
│   ├── content/
│   ├── utils/
│   ├── popup/
│   └── background/
│
├── browsers/                     # BROWSER-SPECIFIC CONFIGS
│   ├── chrome/
│   │   ├── manifest.json         # Chrome Manifest V3
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── public/
│   │
│   └── firefox/
│       ├── manifest.json         # Firefox Manifest V2
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── public/
│
├── package.json                  # Shared npm scripts
└── src/                          # Shared detection logic
```

## Build Commands

### Build for Chrome Only
```bash
npm run build:chrome
# Output: dist-chrome/
```

### Build for Firefox Only
```bash
npm run build:firefox
# Output: dist-firefox/
```

### Build for Both Browsers
```bash
npm run build:all
# Output: dist-chrome/ and dist-firefox/
```

### Development Mode

#### Chrome Development (Watch Mode)
```bash
npm run dev:chrome
# Rebuilds on file changes, output to dist-chrome/
```

#### Firefox Development (Watch Mode)
```bash
npm run dev:firefox
# Rebuilds on file changes, output to dist-firefox/
```

## Packaging for Distribution

### Package Chrome Extension
```bash
npm run package:chrome
# Creates: guardflow-chrome.zip
```

### Package Firefox Extension
```bash
npm run package:firefox
# Creates: guardflow-firefox.zip
```

### Package Both
```bash
npm run package
# Creates: guardflow-chrome.zip and guardflow-firefox.zip
```

## Testing Extensions Locally

### Load Chrome Extension
1. Build: `npm run build:chrome`
2. Open Chrome: `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist-chrome/` folder

### Load Firefox Extension
1. Build: `npm run build:firefox`
2. Open Firefox: `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist-firefox/manifest.json`

## Adding New Features

### Shared Code (Works for All Browsers)
- Add code to `src/` folder
- Automatically used by Chrome and Firefox builds

### Browser-Specific Code
If you need browser-specific logic:

```typescript
// Example: Detect browser and use appropriate API
const isFirefox = typeof browser !== 'undefined';
const isChrome = typeof chrome !== 'undefined';

if (isFirefox) {
  // Use Firefox-specific APIs
  browser.storage.local.get(...)
} else if (isChrome) {
  // Use Chrome-specific APIs
  chrome.storage.local.get(...)
}
```

## Key Differences Between Browsers

### Manifest Version
- **Chrome**: Manifest V3 (latest standard)
- **Firefox**: Manifest V2 (being phased out, but still supported)

### API Namespaces
- **Chrome**: Uses `chrome.*` API
- **Firefox**: Uses `browser.*` API (but also supports `chrome.*` for compatibility)

### Permissions
- **Chrome**: Uses `host_permissions` in Manifest V3
- **Firefox**: Uses `permissions` array including hostnames

### Background Scripts
- **Chrome**: Uses `service_worker` (V3 feature)
- **Firefox**: Uses `scripts` array (V2 feature)

### Browser Action/Action
- **Chrome**: Uses `action` (V3)
- **Firefox**: Uses `browser_action` (V2)

## Compatibility Note

The shared code in `src/` uses APIs that work in both Chrome and Firefox:
- `chrome.storage.local` - Works in both (Firefox aliases it)
- `chrome.activeTab` - Works in both
- Content script injection - Works in both

## Future Browsers

### Adding Safari Support
1. Create `browsers/safari/` folder
2. Add Safari manifest format
3. Update vite configs
4. Add npm scripts: `build:safari`, `dev:safari`, `package:safari`

### Example Safari Structure
```
browsers/safari/
├── manifest.json         # Xcode format or entitlements
├── vite.config.ts
├── tsconfig.json
└── public/
```

## Troubleshooting

### Build fails with path errors
- Ensure you're running commands from the root directory
- Check that `../../src` paths are correct in browser-specific configs

### Extension not loading in Firefox
- Make sure manifest.json has `"manifest_version": 2`
- Check that content scripts use correct paths

### Changes not reflected in browser
- Rebuild: `npm run build:chrome` or `npm run build:firefox`
- Reload extension in browser (usually Cmd+R or Ctrl+R)

## Testing All Browsers

```bash
# Build all
npm run build:all

# Package all
npm run package

# Then:
# - Upload guardflow-chrome.zip to Chrome Web Store
# - Upload guardflow-firefox.zip to Firefox Add-ons Store
```

## Contributing

When submitting PRs:
1. Update shared code in `src/`
2. Test in both Chrome and Firefox
3. Run `npm run build:all` before submitting
4. Update CHANGELOG with browser support details

---

For more info, see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md)
