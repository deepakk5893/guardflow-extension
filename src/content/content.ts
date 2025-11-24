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
 * Setup Enter key interception on window to ensure we catch it first
 */
function setupEnterKeyInterception(config: ReturnType<typeof getCurrentSiteConfig>) {
  if (!config) return;

  // We attach to window with capture to ensure we get the event before the site's handlers
  // even if they are attached to document/body with capture
  window.addEventListener('keydown', (event) => handleGlobalEnterKey(event, config), true);
  window.addEventListener('keypress', (event) => handleGlobalEnterKey(event, config), true);
  window.addEventListener('keyup', (event) => handleGlobalEnterKey(event, config), true);
}

/**
 * Global handler for Enter key events
 */
async function handleGlobalEnterKey(
  event: KeyboardEvent,
  config: ReturnType<typeof getCurrentSiteConfig>
) {
  if (!config) return;

  // Check if Enter was pressed (without Shift)
  const isEnterKey = event.key === 'Enter' && !event.shiftKey;
  if (!isEnterKey) return;

  // Check if the target is our textarea
  const target = event.target as HTMLElement;
  if (!target) return;

  // Check if target matches our selector
  // We use matches() but need to handle potential errors if selector is invalid
  try {
    // For some sites, the target might be a child of the textarea (e.g. a span inside contenteditable)
    // So we check if the target OR any of its parents match the selector
    const textarea = target.closest(config.textarea) as HTMLElement;

    if (!textarea) {
      return; // Not our target
    }

    // If we're allowing the next submit, let it through
    if (allowNextSubmit) {
      allowNextSubmit = false;
      return;
    }

    // Only intercept if not already processing
    if (isProcessingSubmit) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    // Get message text
    const messageText = config.getMessageText(textarea);

    // Skip empty messages
    if (!messageText || messageText.trim().length === 0) {
      return;
    }

    // Prevent default submission - use all three methods to ensure it's blocked
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Mark as processing
    isProcessingSubmit = true;

    // Store original content
    const originalContent = messageText;

    // For contenteditable divs (Claude, ChatGPT), temporarily clear content to prevent submission
    const isContentEditable = textarea.getAttribute('contenteditable') === 'true';
    if (isContentEditable) {
      textarea.textContent = '';
      textarea.innerHTML = '';
      // Dispatch input event to sync with framework state (React, etc.)
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    try {
      // Run secret detection
      const result = await detectSecrets(messageText);

      if (result.hasSecrets) {
        stats.secretsDetected += result.count;

        // Show warning dialog
        const userChoice = await showSecretWarningDialog(result, messageText);

        if (userChoice === 'cancel') {
          stats.secretsBlocked += result.count;
          // Restore content if user cancels
          if (isContentEditable) {
            textarea.textContent = originalContent;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            // Move cursor to end
            placeCaretAtEnd(textarea);
          }
          isProcessingSubmit = false;
          return;
        }

        if (userChoice === 'edit') {
          stats.secretsBlocked += result.count;
          // Restore content for editing
          if (isContentEditable) {
            textarea.textContent = originalContent;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            // Move cursor to end
            placeCaretAtEnd(textarea);
          }
          textarea.focus();
          isProcessingSubmit = false;
          return;
        }

        // User chose to send anyway - restore content
        if (isContentEditable) {
          textarea.textContent = originalContent;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        // No secrets, restore content
        if (isContentEditable) {
          textarea.textContent = originalContent;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      stats.messagesSent++;

      // Allow the submission to proceed
      isProcessingSubmit = false;
      allowNextSubmit = true;

      // Dispatch the Enter key event again to trigger actual submission
      // We need to dispatch it on the original target
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });

      target.dispatchEvent(enterEvent);
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

      target.dispatchEvent(enterEvent);
    }
  } catch (e) {
    // Ignore selector errors
  }
}

/**
 * Helper to place caret at end of contenteditable
 */
function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
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
