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
  console.log('[GuardFlow] Content script initializing...');

  const config = getCurrentSiteConfig();
  if (!config) {
    console.log('[GuardFlow] No site config found for this page');
    return;
  }

  console.log('[GuardFlow] Site config found:', config);

  // Wait for site to be ready
  const isReady = await waitForSiteReady(config, 10000);
  if (!isReady) {
    console.log('[GuardFlow] Site took too long to load');
    return;
  }

  console.log('[GuardFlow] Site is ready, setting up interception');

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

  console.log('[GuardFlow] Looking for submit button:', config.submitButton);

  // Use MutationObserver to handle dynamic button creation
  const observer = new MutationObserver(() => {
    const submitButton = document.querySelector(config.submitButton);
    if (submitButton && !submitButton.hasAttribute('data-guardflow-initialized')) {
      console.log('[GuardFlow] Found submit button via MutationObserver');
      attachSubmitHandler(submitButton as HTMLElement, config);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[GuardFlow] MutationObserver started');

  // Also try to attach immediately
  const submitButton = document.querySelector(config.submitButton);
  if (submitButton) {
    console.log('[GuardFlow] Found submit button immediately');
    attachSubmitHandler(submitButton as HTMLElement, config);
  } else {
    console.log('[GuardFlow] Submit button not found yet, waiting for DOM...');
  }
}

/**
 * Setup Enter key interception on textarea
 */
function setupEnterKeyInterception(config: ReturnType<typeof getCurrentSiteConfig>) {
  if (!config) return;

  console.log('[GuardFlow] Setting up Enter key interception on:', config.textarea);

  // Use MutationObserver to find textarea when it's added
  const observer = new MutationObserver(() => {
    const textarea = document.querySelector(config.textarea) as HTMLElement;
    if (textarea && !textarea.hasAttribute('data-guardflow-keyhandler-initialized')) {
      console.log('[GuardFlow] Found textarea via MutationObserver, attaching key handler');
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
    console.log('[GuardFlow] Found textarea immediately, attaching key handler');
    attachEnterKeyHandler(textarea, config);
  } else {
    console.log('[GuardFlow] Textarea not found yet, waiting for DOM...');
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
  console.log('[GuardFlow] Enter key handler attached to textarea');

  textarea.addEventListener('keydown', async (event: KeyboardEvent) => {
    // Check if Enter was pressed (without Shift for normal chat apps)
    const isEnterKey = event.key === 'Enter' && !event.shiftKey;
    if (!isEnterKey) return;

    console.log('[GuardFlow] Enter key pressed!');

    // If we're allowing the next submit, let it through
    if (allowNextSubmit) {
      console.log('[GuardFlow] Allowing submission via Enter (user bypassed warning)');
      allowNextSubmit = false;
      return;
    }

    // Only intercept if not already processing
    if (isProcessingSubmit) {
      console.log('[GuardFlow] Already processing, ignoring duplicate Enter press');
      return;
    }

    // Get message text
    const messageText = config.getMessageText(textarea);
    console.log('[GuardFlow] Message text extracted, length:', messageText?.length);

    // Skip empty messages
    if (!messageText || messageText.trim().length === 0) {
      console.log('[GuardFlow] Empty message, allowing submission');
      return;
    }

    // Prevent default submission
    event.preventDefault();
    event.stopPropagation();

    // Mark as processing
    isProcessingSubmit = true;

    try {
      // Run secret detection
      console.log('[GuardFlow] Running secret detection...');
      const result = await detectSecrets(messageText);
      console.log('[GuardFlow] Detection result:', result);

      if (result.hasSecrets) {
        console.log('[GuardFlow] Secrets detected! Count:', result.count);
        stats.secretsDetected += result.count;

        // Show warning dialog
        console.log('[GuardFlow] Showing warning dialog...');
        const userChoice = await showSecretWarningDialog(result, messageText);
        console.log('[GuardFlow] User choice:', userChoice);

        if (userChoice === 'cancel') {
          console.log('[GuardFlow] User cancelled submission');
          stats.secretsBlocked += result.count;
          isProcessingSubmit = false;
          return;
        }

        if (userChoice === 'edit') {
          console.log('[GuardFlow] User chose to edit');
          stats.secretsBlocked += result.count;
          textarea.focus();
          isProcessingSubmit = false;
          return;
        }

        // User chose to send anyway
        console.log('[GuardFlow] User chose to send anyway');
      } else {
        console.log('[GuardFlow] No secrets detected');
      }

      stats.messagesSent++;

      // Allow the submission to proceed
      isProcessingSubmit = false;
      allowNextSubmit = true;

      console.log('[GuardFlow] Allowing submission to proceed via Enter key');

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
      console.error('[GuardFlow] Error during secret detection:', error);
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
  console.log('[GuardFlow] Click handler attached to submit button');

  // Intercept click events
  button.addEventListener(
    'click',
    async (event) => {
      console.log('[GuardFlow] Submit button clicked!');

      // If we're allowing the next submit (user chose to send anyway), let it through
      if (allowNextSubmit) {
        console.log('[GuardFlow] Allowing submission (user bypassed warning)');
        allowNextSubmit = false;
        return;
      }

      // Only intercept if not already processing
      if (isProcessingSubmit) {
        console.log('[GuardFlow] Already processing, ignoring duplicate click');
        return;
      }

      // Get the textarea
      const textarea = document.querySelector(config.textarea) as HTMLElement;
      if (!textarea) {
        console.log('[GuardFlow] Textarea not found:', config.textarea);
        return;
      }

      console.log('[GuardFlow] Textarea found');

      // Get message text
      const messageText = config.getMessageText(textarea);
      console.log('[GuardFlow] Message text extracted, length:', messageText?.length);

      // Skip empty messages
      if (!messageText || messageText.trim().length === 0) {
        console.log('[GuardFlow] Empty message, allowing submission');
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
        console.log('[GuardFlow] Running secret detection...');
        const result = await detectSecrets(messageText);
        console.log('[GuardFlow] Detection result:', result);

        if (result.hasSecrets) {
          console.log('[GuardFlow] Secrets detected! Count:', result.count);
          stats.secretsDetected += result.count;

          // Show warning dialog
          console.log('[GuardFlow] Showing warning dialog...');
          const userChoice = await showSecretWarningDialog(result, messageText);
          console.log('[GuardFlow] User choice:', userChoice);

          if (userChoice === 'cancel') {
            console.log('[GuardFlow] User cancelled submission');
            stats.secretsBlocked += result.count;
            isProcessingSubmit = false;
            return;
          }

          if (userChoice === 'edit') {
            console.log('[GuardFlow] User chose to edit');
            stats.secretsBlocked += result.count;
            // Focus textarea so user can edit
            textarea.focus();
            isProcessingSubmit = false;
            return;
          }

          // User chose to send anyway
          console.log('[GuardFlow] User chose to send anyway');
        } else {
          console.log('[GuardFlow] No secrets detected');
        }

        stats.messagesSent++;

        // Allow the submission to proceed
        isProcessingSubmit = false;
        allowNextSubmit = true; // Set flag to skip our handler on next click

        console.log('[GuardFlow] Allowing submission to proceed');

        // Trigger the actual click (this will trigger our handler again, but allowNextSubmit will let it through)
        button.click();
      } catch (error) {
        // On error, allow submission (fail open for better UX)
        console.error('[GuardFlow] Error during secret detection:', error);
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
console.log('[GuardFlow] Content script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[GuardFlow] DOM content loaded');
    await loadStats();
    init();
  });
} else {
  console.log('[GuardFlow] DOM already loaded, initializing immediately');
  loadStats().then(() => init());
}

// Save stats periodically
setInterval(saveStats, 10000); // Every 10 seconds

// Export for debugging
(window as any).__guardflow = {
  stats,
  version: '1.0.0',
};
