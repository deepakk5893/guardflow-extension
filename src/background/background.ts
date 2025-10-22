/**
 * Background Service Worker
 * Handles extension lifecycle events and cross-tab communication
 */

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install - initialize storage with default stats
    chrome.storage.local.set({
      stats: {
        secretsDetected: 0,
        secretsBlocked: 0,
        messagesSent: 0,
      },
      settings: {
        enabled: true,
        sites: {
          'chat.openai.com': true,
          'chatgpt.com': true,
          'claude.ai': true,
          'gemini.google.com': true,
          'www.perplexity.ai': true,
        },
      },
    });

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'https://guardflow.com/extension/welcome' });
  }

});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SECRET_DETECTED') {
    // Could send analytics here (future feature)
  }

  if (message.type === 'GET_STATS') {
    // Respond with stats
    chrome.storage.local.get('stats', (result) => {
      sendResponse(result.stats || {
        secretsDetected: 0,
        secretsBlocked: 0,
        messagesSent: 0,
      });
    });
    return true; // Keep message channel open for async response
  }

  return false;
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  // Service worker activated
});
