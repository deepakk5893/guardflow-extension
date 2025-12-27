/**
 * Background Service Worker
 * Handles extension lifecycle events, heartbeat, and cross-tab communication
 */

// Extension version
const EXTENSION_VERSION = '2.0.0';

// Heartbeat interval (5 minutes)
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

// Detect browser type
const BROWSER = typeof chrome !== 'undefined' && chrome.runtime?.getManifest() ?
  (navigator.userAgent.includes('Firefox') ? 'firefox' : 'chrome') : 'unknown';

/**
 * Send heartbeat to server
 */
async function sendHeartbeat(): Promise<void> {
  try {
    const settings = await chrome.storage.local.get(['serverUrl', 'apiKey', 'stats']);

    if (!settings.serverUrl || !settings.apiKey) {
      return; // Not configured, skip heartbeat
    }

    const response = await fetch(`${settings.serverUrl}/api/v1/extension/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': settings.apiKey,
      },
      body: JSON.stringify({
        extension_version: EXTENSION_VERSION,
        browser: BROWSER,
        is_enabled: true,
        last_scan_timestamp: new Date().toISOString(),
        stats: settings.stats || {},
      }),
    });

    if (!response.ok) {
      console.warn('[Niyantra] Heartbeat failed:', response.status);
    }
  } catch (error) {
    console.warn('[Niyantra] Heartbeat error:', error);
  }
}

/**
 * Fetch and cache server configuration
 */
async function syncConfig(): Promise<void> {
  try {
    const settings = await chrome.storage.local.get(['serverUrl', 'apiKey']);

    if (!settings.serverUrl || !settings.apiKey) {
      return; // Not configured
    }

    const response = await fetch(`${settings.serverUrl}/api/v1/extension/config`, {
      headers: {
        'X-API-Key': settings.apiKey,
      },
    });

    if (response.ok) {
      const config = await response.json();
      await chrome.storage.local.set({ serverConfig: config });
      console.log('[Niyantra] Config synced from server');
    }
  } catch (error) {
    console.warn('[Niyantra] Config sync error:', error);
  }
}

/**
 * Start heartbeat timer
 */
function startHeartbeatTimer(): void {
  // Send initial heartbeat
  sendHeartbeat();

  // Schedule recurring heartbeats using alarms (more reliable in service workers)
  chrome.alarms.create('niyantra-heartbeat', {
    periodInMinutes: 5,
  });
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'niyantra-heartbeat') {
    sendHeartbeat();
  }
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install - initialize storage with default stats
    chrome.storage.local.set({
      stats: {
        secretsDetected: 0,
        secretsBlocked: 0,
        messagesSent: 0,
        serverScans: 0,
        serverErrors: 0,
      },
      settings: {
        enabled: true,
        sites: {
          'chat.openai.com': true,
          'chatgpt.com': true,
          'claude.ai': true,
          'gemini.google.com': true,
          'www.perplexity.ai': true,
          'grok.com': true,
        },
      },
      scanMode: 'hybrid', // Default scan mode
    });

    console.log('[Niyantra] Extension installed');
  }

  if (details.reason === 'update') {
    console.log('[Niyantra] Extension updated to', EXTENSION_VERSION);
  }

  // Start heartbeat on install/update
  startHeartbeatTimer();

  // Sync config from server
  syncConfig();
});

// Start heartbeat on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Niyantra] Browser started');
  startHeartbeatTimer();
  syncConfig();
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SECRET_DETECTED') {
    // Could send analytics here (future feature)
  }

  if (message.type === 'API_REQUEST') {
    // Proxy HTTP requests from content scripts (avoids PNA restrictions)
    (async () => {
      try {
        const settings = await chrome.storage.local.get(['serverUrl', 'apiKey']);

        if (!settings.serverUrl || !settings.apiKey) {
          sendResponse({ error: 'API client not configured' });
          return;
        }

        const url = `${settings.serverUrl}${message.endpoint}`;
        const options: RequestInit = {
          method: message.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': settings.apiKey,
          },
        };

        if (message.body) {
          options.body = JSON.stringify(message.body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
          let errorMessage = `Request failed: ${response.status}`;
          if (response.status === 401) {
            errorMessage = 'Invalid API key';
          } else if (response.status === 403) {
            errorMessage = 'Access denied';
          } else if (response.status === 413) {
            errorMessage = 'File too large';
          } else if (response.status === 415) {
            errorMessage = 'Unsupported file type';
          }
          sendResponse({ error: errorMessage });
          return;
        }

        const data = await response.json();
        sendResponse({ data });
      } catch (error) {
        sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_STATS') {
    // Respond with stats
    chrome.storage.local.get('stats', (result) => {
      sendResponse(result.stats || {
        secretsDetected: 0,
        secretsBlocked: 0,
        messagesSent: 0,
        serverScans: 0,
        serverErrors: 0,
      });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'SETTINGS_UPDATED') {
    // Settings were updated from popup, sync config
    syncConfig();

    // Notify all content scripts about settings change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_CHANGED',
            serverUrl: message.serverUrl,
            apiKey: message.apiKey,
            scanMode: message.scanMode,
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      });
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_CONFIG') {
    // Return cached server config
    chrome.storage.local.get('serverConfig', (result) => {
      sendResponse(result.serverConfig || null);
    });
    return true;
  }

  if (message.type === 'FORCE_SYNC_CONFIG') {
    // Force re-sync config from server
    syncConfig().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  return false;
});

// Handle extension icon click (show popup)
chrome.action.onClicked.addListener(() => {
  // Popup is handled by manifest, this is for programmatic control if needed
});

// Log when service worker activates
console.log('[Niyantra] Background service worker initialized');
