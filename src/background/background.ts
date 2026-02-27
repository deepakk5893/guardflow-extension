/**
 * Background Service Worker
 * Handles extension lifecycle events, heartbeat, cross-tab communication,
 * Shadow AI detection, and Enterprise Authentication.
 */

import { shadowAIManager, VERSION_CHECK_ALARM_NAME } from '../shadow-ai/shadow-ai-manager';
import { initializeAuth, completeSSOLogin, isEnterpriseManaged, logout, type AuthState } from '../auth/enterprise-auth';
import { storageGet, storageSet } from '../utils/storage';

// Extension version
const EXTENSION_VERSION = '2.0.0';

// Note: Heartbeat uses chrome.alarms instead of setInterval for reliability

// Detect browser type
const BROWSER = typeof chrome !== 'undefined' && chrome.runtime?.getManifest() ?
  (navigator.userAgent.includes('Firefox') ? 'firefox' : 'chrome') : 'unknown';

/**
 * Send heartbeat to server
 * Also caches the success/failure status for fast fail-open on file scans
 */
async function sendHeartbeat(): Promise<void> {
  try {
    const settings = await storageGet(['serverUrl', 'apiKey', 'stats', 'serverConfig']);

    if (!settings.serverUrl || !settings.apiKey) {
      return; // Not configured, skip heartbeat
    }

    // Send the extension's current site config version so the server can flag staleness
    const currentConfigVersion = settings.serverConfig?.site_config_bundle?.config_version || null;

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
        config_version: currentConfigVersion,
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout for heartbeat
    });

    if (response.ok) {
      // Cache successful heartbeat
      await storageSet({
        lastHeartbeat: { success: true, timestamp: Date.now() },
      });

      // Check if server says we need to re-sync config (selector update)
      try {
        const data = await response.json();
        if (data.force_config_update) {
          console.log('[Niyantra] Server flagged config update, re-syncing...');
          syncConfig();
        }
      } catch {
        // JSON parse failure is non-fatal
      }
    } else {
      console.warn('[Niyantra] Heartbeat failed:', response.status);
      await storageSet({
        lastHeartbeat: { success: false, timestamp: Date.now() },
      });
    }
  } catch (error) {
    console.warn('[Niyantra] Heartbeat error:', error);
    // Cache failed heartbeat
    await storageSet({
      lastHeartbeat: { success: false, timestamp: Date.now() },
    });
  }
}

/**
 * Fetch and cache server configuration
 */
async function syncConfig(): Promise<void> {
  try {
    const settings = await storageGet(['serverUrl', 'apiKey']);

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
      await storageSet({ serverConfig: config });
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

  // Handle Shadow AI version check alarm
  if (alarm.name === VERSION_CHECK_ALARM_NAME) {
    shadowAIManager.handleAlarm(alarm.name);
  }
});

// Store auth state for quick access
let currentAuthState: AuthState | null = null;

/**
 * Initialize enterprise authentication
 */
async function initEnterpriseAuth(): Promise<void> {
  try {
    currentAuthState = await initializeAuth();
    console.log('[Niyantra] Auth state:', currentAuthState.authMode,
      currentAuthState.isConfigured ? 'configured' : 'not configured',
      currentAuthState.needsSSOLogin ? 'needs SSO' : '');

    // Store auth state for popup
    await storageSet({ authState: currentAuthState });
  } catch (error) {
    console.error('[Niyantra] Enterprise auth init failed:', error);
  }
}

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install - initialize storage with default stats
    storageSet({
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

  // Initialize enterprise authentication first
  await initEnterpriseAuth();

  // Start heartbeat on install/update
  startHeartbeatTimer();

  // Sync config from server
  syncConfig();

  // Initialize Shadow AI
  await shadowAIManager.init();
  shadowAIManager.startVersionPolling();
});

// Start heartbeat on browser startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Niyantra] Browser started');

  // Initialize enterprise authentication
  await initEnterpriseAuth();

  startHeartbeatTimer();
  syncConfig();

  // Initialize Shadow AI
  await shadowAIManager.init();
  shadowAIManager.startVersionPolling();
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
        const settings = await storageGet(['serverUrl', 'apiKey', 'lastHeartbeat']);

        if (!settings.serverUrl || !settings.apiKey) {
          sendResponse({ error: 'API client not configured' });
          return;
        }

        // Fast fail-open for file scans if backend is known to be down
        if (message.endpoint.includes('scan-file') && settings.lastHeartbeat) {
          const timeSinceLastHeartbeat = Date.now() - settings.lastHeartbeat.timestamp;
          // If heartbeat failed in last 60 seconds, skip scan immediately
          if (!settings.lastHeartbeat.success && timeSinceLastHeartbeat < 60000) {
            console.log('[Niyantra] Backend down (heartbeat failed), allowing file through');
            sendResponse({ error: 'Backend unavailable. File allowed through.' });
            return;
          }
        }

        // Quick health check for file scans - detect unreachable backend fast (2s timeout)
        // This prevents waiting 10+ seconds when backend is completely down
        // If backend is reachable but slow (processing large file), the actual scan can take longer
        if (message.endpoint.includes('scan-file')) {
          let backendReachable = false;
          try {
            const healthResponse = await fetch(`${settings.serverUrl}/health`, {
              signal: AbortSignal.timeout(2000), // 2 second timeout for health check
            });
            backendReachable = healthResponse.ok;
          } catch {
            backendReachable = false;
          }

          if (!backendReachable) {
            // Backend is unreachable - fail-open immediately
            console.log('[Niyantra] Backend unreachable (health check failed), allowing file through');
            // Update heartbeat cache async (don't wait for it)
            storageSet({
              lastHeartbeat: { success: false, timestamp: Date.now() },
            }).catch(() => {});
            sendResponse({ error: 'Backend unreachable. File allowed through.' });
            return;
          }
        }

        const url = `${settings.serverUrl}${message.endpoint}`;

        // Timeout: 30s for file scanning (large files with OCR can take time), 5s for other requests
        const timeout = message.endpoint.includes('scan-file') ? 30000 : 5000;

        const options: RequestInit = {
          method: message.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': settings.apiKey,
          },
          signal: AbortSignal.timeout(timeout),
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
        // Provide user-friendly error messages
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            errorMessage = 'Server not responding (timeout). File allowed through.';
          } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Cannot connect to server. File allowed through.';
          } else {
            errorMessage = error.message;
          }
        }
        sendResponse({ error: errorMessage });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_STATS') {
    // Respond with stats
    storageGet(['stats']).then((result) => {
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
          try {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_CHANGED',
              serverUrl: message.serverUrl,
              apiKey: message.apiKey,
              scanMode: message.scanMode,
            });
          } catch {
            // Ignore errors for tabs without content script
          }
        }
      });
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_CONFIG') {
    // Return cached server config
    storageGet(['serverConfig']).then((result) => {
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

  // ============== Log-Only / Monitoring Mode Handlers ==============

  if (message.type === 'LOG_MESSAGE_MONITORING') {
    // Fire-and-forget: Log message text for monitoring mode
    // Uses keepalive to ensure request completes even if tab closes
    (async () => {
      try {
        const settings = await storageGet(['serverUrl', 'apiKey']);
        if (!settings.serverUrl || !settings.apiKey) {
          console.warn('[Niyantra] Cannot log message: API not configured');
          return;
        }

        fetch(`${settings.serverUrl}/api/v1/extension/log-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': settings.apiKey,
          },
          body: JSON.stringify(message.body),
          keepalive: true, // Ensures request completes even if tab closes
        }).catch((error) => {
          console.warn('[Niyantra] Failed to log message:', error);
          // Could queue for retry here (future enhancement)
        });
      } catch (error) {
        console.warn('[Niyantra] Log message error:', error);
      }
    })();

    sendResponse({ acknowledged: true });
    return true;
  }

  if (message.type === 'LOG_FILE_MONITORING') {
    // Fire-and-forget: Log file for monitoring mode
    // Note: Large files may not complete with keepalive - accept potential loss
    (async () => {
      try {
        const settings = await storageGet(['serverUrl', 'apiKey']);
        if (!settings.serverUrl || !settings.apiKey) {
          console.warn('[Niyantra] Cannot log file: API not configured');
          return;
        }

        fetch(`${settings.serverUrl}/api/v1/extension/log-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': settings.apiKey,
          },
          body: JSON.stringify(message.body),
          keepalive: true, // Best effort - large files may not complete
        }).catch((error) => {
          console.warn('[Niyantra] Failed to log file:', error);
          // Could queue for retry here (future enhancement)
        });
      } catch (error) {
        console.warn('[Niyantra] Log file error:', error);
      }
    })();

    sendResponse({ acknowledged: true });
    return true;
  }

  // ============== Enterprise SSO Handlers ==============

  if (message.type === 'GET_AUTH_STATE') {
    // Return current auth state
    (async () => {
      if (!currentAuthState) {
        currentAuthState = await initializeAuth();
      }
      sendResponse(currentAuthState);
    })();
    return true;
  }

  if (message.type === 'INIT_ENTERPRISE_AUTH') {
    // Re-initialize enterprise auth
    (async () => {
      try {
        await initEnterpriseAuth();
        sendResponse({ success: true, authState: currentAuthState });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'COMPLETE_SSO_LOGIN') {
    // Complete SSO login flow
    (async () => {
      try {
        const { serverUrl, tenantToken, ssoProvider } = message;
        const authState = await completeSSOLogin(serverUrl, tenantToken, ssoProvider);
        currentAuthState = authState;

        // Update local storage
        await storageSet({ authState });

        // Sync config after SSO login
        await syncConfig();

        sendResponse({ success: true, authState });
      } catch (error) {
        console.error('[Niyantra] SSO login failed:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'IS_ENTERPRISE_MANAGED') {
    // Check if extension is managed by Chrome Enterprise policy
    (async () => {
      const managed = await isEnterpriseManaged();
      sendResponse(managed);
    })();
    return true;
  }

  if (message.type === 'LOGOUT') {
    // Handle logout - clear SSO credentials and re-initialize
    (async () => {
      try {
        await logout();
        // Re-initialize to check if we need SSO login again
        currentAuthState = await initializeAuth();
        await storageSet({ authState: currentAuthState });
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Niyantra] Logout failed:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  return false;
});

// Handle extension icon click (show popup)
// chrome.action is MV3 (Chrome), chrome.browserAction is MV2 (Firefox)
const actionAPI = chrome.action || chrome.browserAction;
if (actionAPI?.onClicked) {
  actionAPI.onClicked.addListener(() => {
    // Popup is handled by manifest, this is for programmatic control if needed
  });
}

// ============== Shadow AI Navigation Detection ==============

/**
 * Listen for navigation to check against Shadow AI list
 * This runs on ALL URLs to detect unauthorized AI tool access
 */
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    // Only check main frame (not iframes)
    if (details.frameId !== 0) return;

    // Ensure Shadow AI manager is initialized
    if (!shadowAIManager.isEnabled()) {
      return;
    }

    const result = shadowAIManager.checkUrl(details.url);
    if (!result) return; // Not a Shadow AI site

    // Only log actual Shadow AI detections (block, warn, log)
    // Skip 'allow' actions - these are whitelisted/supported sites
    if (result.action !== 'allow') {
      shadowAIManager.logDetection(result.domain, result.action);
    }

    if (result.action === 'block') {
      // Redirect to block page
      const blockPageUrl = chrome.runtime.getURL(
        `blocked/blocked.html?domain=${encodeURIComponent(result.domain)}&name=${encodeURIComponent(result.name)}&category=${encodeURIComponent(result.category)}`
      );

      chrome.tabs.update(details.tabId, { url: blockPageUrl });
    }
    // For 'warn' and 'log', let navigation proceed
    // Warning banner injection is handled by the shadow-ai-banner content script
  },
  { url: [{ schemes: ['http', 'https'] }] }
);

// ============== Shadow AI Message Handlers ==============

// Extend the existing message handler with Shadow AI messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Check if this is a Shadow AI URL check request
  if (message.type === 'CHECK_SHADOW_AI') {
    const result = shadowAIManager.checkUrl(message.url);
    sendResponse(result);
    return true;
  }

  // Log Shadow AI detection from content script
  if (message.type === 'LOG_SHADOW_AI') {
    shadowAIManager.logDetection(message.domain, message.action);
    sendResponse({ success: true });
    return true;
  }

  // Get Shadow AI list for popup
  if (message.type === 'GET_SHADOW_AI_LIST') {
    sendResponse(shadowAIManager.getList());
    return true;
  }

  // Get Shadow AI stats for popup
  if (message.type === 'GET_SHADOW_AI_STATS') {
    sendResponse(shadowAIManager.getStats());
    return true;
  }

  // Force sync Shadow AI list
  if (message.type === 'SYNC_SHADOW_AI_LIST') {
    shadowAIManager.syncList().then(() => {
      sendResponse({ success: true, list: shadowAIManager.getList() });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  return false;
});

// Log when service worker activates
console.log('[Niyantra] Background service worker initialized');
