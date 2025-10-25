/**
 * Content script - Injected into AI chat pages
 * Intercepts message submissions and checks for secrets
 */

import { detectSecrets } from '~/utils/secretDetection';
import { getCurrentSiteConfig, waitForSiteReady } from './site-configs';
import { showSecretWarningDialog } from './dialog';

// Track if we're currently processing a submission
let isProcessingSubmit = false;
// Track if we should allow the next submission without checking
let allowNextSubmit = false;

// Track stats
interface Stats {
  secretsDetected: number;
  secretsBlocked: number;
  messagesSent: number;
}

const stats: Stats = {
  secretsDetected: 0,
  secretsBlocked: 0,
  messagesSent: 0,
};

/**
 * Initialize the content script
 */
async function init() {
  const config = getCurrentSiteConfig();
  if (!config) {
    return;
  }

  // Wait for site to be ready
  const isReady = await waitForSiteReady(config, 10000);
  if (!isReady) {
    return;
  }

  // Setup submit button interception
  setupSubmitInterception(config);

  // Setup Enter key interception on textarea
  setupEnterKeyInterception(config);
}

/**
 * Setup interception of submit button
 */
function setupSubmitInterception(config: ReturnType<typeof getCurrentSiteConfig>) {
  if (!config) return;

  // Use MutationObserver to handle dynamic button creation
  const observer = new MutationObserver(() => {
    const submitButton = document.querySelector(config.submitButton);
    if (submitButton && !submitButton.hasAttribute('data-guardflow-initialized')) {
      attachSubmitHandler(submitButton as HTMLElement, config);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also try to attach immediately
  const submitButton = document.querySelector(config.submitButton);
  if (submitButton) {
    attachSubmitHandler(submitButton as HTMLElement, config);
  }
}

/**
 * Setup Enter key interception on textarea
 */
function setupEnterKeyInterception(config: ReturnType<typeof getCurrentSiteConfig>) {
  if (!config) return;

  // Use MutationObserver to find textarea when it's added
  const observer = new MutationObserver(() => {
    const textarea = document.querySelector(config.textarea) as HTMLElement;
    if (textarea && !textarea.hasAttribute('data-guardflow-keyhandler-initialized')) {
      attachEnterKeyHandler(textarea, config);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also try immediately
  const textarea = document.querySelector(config.textarea) as HTMLElement;
  if (textarea) {
    attachEnterKeyHandler(textarea, config);
  }
}

/**
 * Attach Enter key handler to textarea
 */
function attachEnterKeyHandler(
  textarea: HTMLElement,
  config: ReturnType<typeof getCurrentSiteConfig>,
) {
  if (!config) return;

  textarea.setAttribute('data-guardflow-keyhandler-initialized', 'true');

  textarea.addEventListener('keydown', async (event: KeyboardEvent) => {
    // Check if Enter was pressed (without Shift for normal chat apps)
    const isEnterKey = event.key === 'Enter' && !event.shiftKey;
    if (!isEnterKey) return;

    // If we're allowing the next submit, let it through
    if (allowNextSubmit) {
      allowNextSubmit = false;
      return;
    }

    // Only intercept if not already processing
    if (isProcessingSubmit) {
      return;
    }

    // Get message text
    const messageText = config.getMessageText(textarea);

    // Skip empty messages
    if (!messageText || messageText.trim().length === 0) {
      return;
    }

    // Prevent default submission
    event.preventDefault();
    event.stopPropagation();

    // Mark as processing
    isProcessingSubmit = true;

    try {
      // Run secret detection
      const result = await detectSecrets(messageText);

      if (result.hasSecrets) {
        stats.secretsDetected += result.count;

        // Show warning dialog
        const userChoice = await showSecretWarningDialog(result, messageText);

        if (userChoice === 'cancel') {
          stats.secretsBlocked += result.count;
          isProcessingSubmit = false;
          return;
        }

        if (userChoice === 'edit') {
          stats.secretsBlocked += result.count;
          textarea.focus();
          isProcessingSubmit = false;
          return;
        }

        // User chose to send anyway
      }

      stats.messagesSent++;

      // Allow the submission to proceed
      isProcessingSubmit = false;
      allowNextSubmit = true;

      // Dispatch the Enter key event again to trigger actual submission
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });

      textarea.dispatchEvent(enterEvent);
    } catch (error) {
      isProcessingSubmit = false;
      allowNextSubmit = true;

      // Dispatch Enter event to allow submission on error
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });

      textarea.dispatchEvent(enterEvent);
    }
  });
}

/**
 * Attach click handler to submit button
 */
function attachSubmitHandler(
  button: HTMLElement,
  config: ReturnType<typeof getCurrentSiteConfig>,
) {
  if (!config) return;

  // Mark as initialized
  button.setAttribute('data-guardflow-initialized', 'true');

  // Intercept click events
  button.addEventListener(
    'click',
    async (event) => {
      // If we're allowing the next submit (user chose to send anyway), let it through
      if (allowNextSubmit) {
        allowNextSubmit = false;
        return;
      }

      // Only intercept if not already processing
      if (isProcessingSubmit) {
        return;
      }

      // Get the textarea
      const textarea = document.querySelector(config.textarea) as HTMLElement;
      if (!textarea) {
        return;
      }

      // Get message text
      const messageText = config.getMessageText(textarea);

      // Skip empty messages
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      // Prevent default submission
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Mark as processing
      isProcessingSubmit = true;

      try {
        // Run secret detection
        const result = await detectSecrets(messageText);

        if (result.hasSecrets) {
          stats.secretsDetected += result.count;

          // Show warning dialog
          const userChoice = await showSecretWarningDialog(result, messageText);

          if (userChoice === 'cancel') {
            stats.secretsBlocked += result.count;
            isProcessingSubmit = false;
            return;
          }

          if (userChoice === 'edit') {
            stats.secretsBlocked += result.count;
            // Focus textarea so user can edit
            textarea.focus();
            isProcessingSubmit = false;
            return;
          }

          // User chose to send anyway
        }

        stats.messagesSent++;

        // Allow the submission to proceed
        isProcessingSubmit = false;
        allowNextSubmit = true; // Set flag to skip our handler on next click

        // Trigger the actual click (this will trigger our handler again, but allowNextSubmit will let it through)
        button.click();
      } catch (error) {
        // On error, allow submission (fail open for better UX)
        isProcessingSubmit = false;
        allowNextSubmit = true;
        button.click();
      }
    },
    true, // Use capture phase to ensure we intercept first
  );
}

/**
 * Save stats to storage
 */
async function saveStats() {
  try {
    await chrome.storage.local.set({ stats });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Load stats from storage
 */
async function loadStats() {
  try {
    const result = await chrome.storage.local.get('stats');
    if (result.stats) {
      Object.assign(stats, result.stats);
    }
  } catch (error) {
    // Silently fail
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await loadStats();
    init();
  });
} else {
  loadStats().then(() => init());
}

// Save stats periodically
setInterval(saveStats, 10000); // Every 10 seconds

// Export for debugging
(window as any).__guardflow = {
  stats,
  version: '1.0.0',
};
