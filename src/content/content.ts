/**
 * Content script - Injected into AI chat pages
 * Intercepts message submissions and checks for secrets/PII
 *
 * Supports three scanning modes:
 * - Local only: Fast regex-based detection (original behavior)
 * - Server only: Full server-side scanning with GLiNER
 * - Hybrid: Local first, then server for thorough detection
 */

import { detectSecrets } from '~/utils/secretDetection';
import { getCurrentSiteConfig, waitForSiteReady, loadServerSiteConfigs } from './site-configs';
import {
  showEnhancedWarningDialog,
  showScanningOverlay,
  type OverrideResult,
} from './dialog';
import { apiClient, type PIIDetection, type OverrideConfig, type TokenInfo, type TierAction, type PIITier } from './api-client';
import { initFileInterceptor, getFileStats } from './file-interceptor';
import { storageGet, storageSet } from '../utils/storage';

// Track if we're currently processing a submission
let isProcessingSubmit = false;
// Track if we should allow the next submission without checking
let allowNextSubmit = false;

// Scan mode types
type ScanMode = 'local' | 'server' | 'hybrid';

// Track stats
interface Stats {
  secretsDetected: number;
  secretsBlocked: number;
  secretsOverridden: number;
  messagesSent: number;
  serverScans: number;
  serverErrors: number;
}

const stats: Stats = {
  secretsDetected: 0,
  secretsBlocked: 0,
  secretsOverridden: 0,
  messagesSent: 0,
  serverScans: 0,
  serverErrors: 0,
};

// Scan result interface (unified for local and server)
interface ScanResult {
  hasViolations: boolean;
  shouldBlock: boolean;
  detections: PIIDetection[];
  redactedText?: string;
  tokenMap?: Record<string, TokenInfo>;
  source: 'local' | 'server' | 'hybrid';
  overrideConfig?: OverrideConfig;
  fileViolations?: Array<{
    filename: string;
    detections: PIIDetection[];
    redactedDocument?: string;
  }>;
}

/**
 * Get current scan mode from storage
 */
async function getScanMode(): Promise<ScanMode> {
  try {
    const result = await storageGet(['scanMode']);
    return result.scanMode || 'hybrid'; // Default to hybrid
  } catch {
    return 'hybrid';
  }
}

/**
 * Perform hybrid scanning (local + server) for message text
 * Note: Files are scanned on upload (not here) because ChatGPT pre-uploads immediately
 */
async function performScan(
  messageText: string,
  platform: string,
): Promise<ScanResult> {
  const scanMode = await getScanMode();

  // Local-only mode
  if (scanMode === 'local' || !apiClient.isConfigured()) {
    const localResult = await detectSecrets(messageText);
    return {
      hasViolations: localResult.hasSecrets,
      shouldBlock: localResult.hasSecrets,
      detections: localResult.secrets.map((s) => ({
        type: s.type,
        category: 'hard' as const,
        tier: 'critical' as const,
        start: s.index,
        end: s.index + s.length,
        preview: s.preview,
        severity: s.severity || 'high',
        confidence: 1.0,
        allow_override: false,
      })),
      redactedText: undefined,
      source: 'local',
    };
  }

  // Server-only or hybrid mode - try server first
  try {
    // Initialize API client if needed
    if (!apiClient.isInitialized()) {
      await apiClient.initialize();
    }

    // Skip server scan if not configured
    if (!apiClient.isConfigured()) {
      // Fallback to local
      const localResult = await detectSecrets(messageText);
      return {
        hasViolations: localResult.hasSecrets,
        shouldBlock: localResult.hasSecrets,
        detections: localResult.secrets.map((s) => ({
          type: s.type,
          category: 'hard' as const,
          tier: 'critical' as const,
          start: s.index,
          end: s.index + s.length,
          preview: s.preview,
          severity: s.severity || 'high',
          confidence: 1.0,
          allow_override: false,
        })),
        redactedText: undefined,
        source: 'local',
      };
    }

    stats.serverScans++;

    // Call server API
    const serverResponse = await apiClient.scanMessage(messageText, platform);

    return {
      hasViolations: serverResponse.has_violations,
      shouldBlock: serverResponse.should_block,
      detections: serverResponse.detections,
      redactedText: serverResponse.redacted_text,
      tokenMap: serverResponse.token_map,
      source: 'server',
      overrideConfig: serverResponse.override_config,
    };
  } catch (error) {
    console.warn('[Niyantra] Server scan failed, falling back to local:', error);
    stats.serverErrors++;

    // Fallback to local detection on server error
    const localResult = await detectSecrets(messageText);
    return {
      hasViolations: localResult.hasSecrets,
      shouldBlock: localResult.hasSecrets,
      detections: localResult.secrets.map((s) => ({
        type: s.type,
        category: 'hard' as const,
        tier: 'critical' as const,
        start: s.index,
        end: s.index + s.length,
        preview: s.preview,
        severity: s.severity || 'high',
        confidence: 1.0,
        allow_override: false,
      })),
      redactedText: undefined,
      source: 'local',
    };
  }
}

/**
 * Handle scan result and show dialog if needed
 * Returns: 'allow' | 'block' | 'redacted' (with redacted text)
 */
/**
 * Get effective tier action for a detection (backward compat with old servers).
 * Uses tier_action if present; otherwise derives from legacy allow_override + require_reason_tiers.
 */
function effectiveTierAction(d: PIIDetection, overrideConfig?: OverrideConfig): TierAction {
  if (d.tier_action) return d.tier_action;
  // Backward compat: derive from legacy fields
  if (!d.allow_override) return 'block';
  const tier = d.tier || 'critical';
  if (overrideConfig?.require_reason_tiers?.includes(tier as PIITier)) return 'block_with_override';
  return 'warn';
}

async function handleScanResult(
  result: ScanResult,
  messageText: string,
  textarea: HTMLElement,
  config: ReturnType<typeof getCurrentSiteConfig>,
): Promise<{ action: 'allow' | 'block'; redactedText?: string }> {
  if (!result.hasViolations) {
    return { action: 'allow' };
  }

  stats.secretsDetected += result.detections.length;
  if (result.fileViolations) {
    stats.secretsDetected += result.fileViolations.reduce((sum, fv) => sum + fv.detections.length, 0);
  }

  // Filter out audit-only detections - they don't trigger a dialog
  const visibleDetections = result.detections.filter(
    (d) => effectiveTierAction(d, result.overrideConfig) !== 'audit'
  );

  // If ALL detections are audit-only, allow through silently (just logging)
  const allFileAudit = !result.fileViolations || result.fileViolations.every(
    (fv) => fv.detections.every((d) => effectiveTierAction(d, result.overrideConfig) === 'audit')
  );
  if (visibleDetections.length === 0 && allFileAudit) {
    console.log('[Niyantra] All detections are audit-only, allowing through silently');
    return { action: 'allow' };
  }

  // Show enhanced dialog with only visible (non-audit) detections
  const userChoice = await showEnhancedWarningDialog(
    visibleDetections,
    messageText,
    result.redactedText,
    result.fileViolations,
    result.overrideConfig,
    result.tokenMap,
  );

  if (userChoice === 'cancel') {
    stats.secretsBlocked += result.detections.length;
    // Clear all file inputs if there are file violations
    if (result.fileViolations && result.fileViolations.length > 0) {
      clearFileInputs(config);
    }
    return { action: 'block' };
  }

  if (userChoice === 'edit') {
    stats.secretsBlocked += result.detections.length;
    textarea.focus();
    // Clear all file inputs if there are file violations (can't edit files)
    if (result.fileViolations && result.fileViolations.length > 0) {
      clearFileInputs(config);
    }
    return { action: 'block' };
  }

  if (userChoice === 'send-redacted') {
    // Clear file inputs with violations (files are blocked, only message can be redacted)
    if (result.fileViolations && result.fileViolations.length > 0) {
      clearFileInputs(config);
    }

    // Replace message with redacted version if available
    if (result.redactedText && config) {
      setMessageText(textarea, result.redactedText, config);
    }

    return { action: 'allow', redactedText: result.redactedText };
  }

  // Handle "Send Anyway" - user chose to bypass overridable detections
  if (typeof userChoice === 'object' && userChoice.choice === 'send-anyway') {
    const overrideResult = userChoice as OverrideResult;

    // Log each overridden detection to the server for audit trail
    if (apiClient.isConfigured() && config) {
      try {
        for (const detection of overrideResult.overriddenDetections) {
          await apiClient.logOverride({
            pii_type: detection.type,
            pii_tier: detection.tier || 'contextual',
            override_reason_category: overrideResult.overrideReasonCategory,
            reason: overrideResult.reason,
            platform: config.name,
            detection_source: 'text',
          });
        }
        stats.secretsOverridden += overrideResult.overriddenDetections.length;
        console.log('[Niyantra] Override logged for', overrideResult.overriddenDetections.length, 'items');
      } catch (error) {
        console.warn('[Niyantra] Failed to log override:', error);
        // Still allow the message to be sent even if logging fails
      }
    }

    // Clear file inputs with violations (files can't be overridden, only message)
    if (result.fileViolations && result.fileViolations.length > 0) {
      clearFileInputs(config);
    }

    // Allow message to be sent as-is (no redaction)
    return { action: 'allow' };
  }

  // Default: block
  return { action: 'block' };
}

/**
 * Helper to set message text in textarea
 */
function setMessageText(
  element: HTMLElement,
  text: string,
  config: ReturnType<typeof getCurrentSiteConfig>
) {
  if (!config) return;

  if (config.setMessageText) {
    config.setMessageText(element, text);
  } else {
    // Fallback for sites without custom setter
    if (element instanceof HTMLTextAreaElement) {
      element.value = text;
    } else {
      element.innerText = text;
    }
    // Trigger input events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Helper to clear all file inputs (removes attached files)
 */
function clearFileInputs(config: ReturnType<typeof getCurrentSiteConfig> | null) {
  if (!config) return;

  // Find all file inputs and clear them
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach((input) => {
    const htmlInput = input as HTMLInputElement;
    htmlInput.value = ''; // Clear the file input
  });

  console.log('[Niyantra] Cleared file inputs due to violations');
}

/**
 * Initialize the content script
 */
async function init() {
  // Load server-driven site configs before resolving the current site
  try {
    await loadServerSiteConfigs();
  } catch (e) {
    // Non-fatal — hardcoded SITE_CONFIGS will be used as fallback
    console.warn('[Niyantra] Failed to load server site configs:', e);
  }

  const config = getCurrentSiteConfig();

  if (!config) {
    return;
  }

  // Initialize API client for server-side scanning
  try {
    await apiClient.initialize();
    if (apiClient.isConfigured()) {
      console.log('[Niyantra] Server scanning enabled:', apiClient.getServerUrl());
    } else {
      console.log('[Niyantra] Local-only scanning (server not configured)');
    }
  } catch (e) {
    console.warn('[Niyantra] Failed to initialize API client:', e);
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

  // Initialize file interception (for attachments)
  initFileInterceptor();

  console.log('[Niyantra] Content script initialized for', config.name);
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

    // Get message text early for log_only mode check
    const messageText = config.getMessageText(textarea);

    // Skip empty messages
    if (!messageText || messageText.trim().length === 0) {
      return;
    }

    // MONITORING MODE: Log and allow through immediately (no blocking, no UI)
    if (apiClient.isLogOnlyMode()) {
      apiClient.logMessage(messageText, config.name);  // Fire-and-forget
      return;  // Allow event to proceed naturally
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

    // Prevent default submission - use all three methods to ensure it's blocked
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Mark as processing
    isProcessingSubmit = true;

    // Show scanning overlay if server scanning is enabled
    let removeOverlay: (() => void) | null = null;
    if (apiClient.isConfigured()) {
      removeOverlay = showScanningOverlay();
    }

    try {
      // Run message text scanning (files are scanned on upload)
      const result = await performScan(messageText, config.name);

      // Remove scanning overlay
      if (removeOverlay) removeOverlay();

      // Handle the scan result
      const { action, redactedText } = await handleScanResult(
        result,
        messageText,
        textarea,
        config,
      );

      if (action === 'block') {
        isProcessingSubmit = false;
        return;
      }

      stats.messagesSent++;

      // Allow the submission to proceed
      isProcessingSubmit = false;
      allowNextSubmit = true;

      // Click the submit button to trigger submission
      // Use setTimeout to ensure we're out of the current event handling context
      setTimeout(() => {
        const submitButton = document.querySelector(config.submitButton) as HTMLElement;
        if (submitButton) {
          // Check textarea content before clicking
          const textareaCheck = document.querySelector(config.textarea) as HTMLElement;
          const currentText = textareaCheck ? config.getMessageText(textareaCheck) : '';

          // Use redacted text if available, otherwise restore original
          const textToSend = redactedText || messageText;

          // If textarea is empty but we had a message, restore it
          if ((!currentText || currentText.trim().length === 0) && textToSend && textareaCheck) {
            setMessageText(textareaCheck, textToSend, config);
          }

          submitButton.click();
        }
      }, 0);
    } catch (error) {
      // Remove scanning overlay on error
      if (removeOverlay) removeOverlay();

      console.error('[Niyantra] Scan error:', error);
      isProcessingSubmit = false;
      allowNextSubmit = true;

      // On error, try to submit anyway by clicking button
      setTimeout(() => {
        const submitButton = document.querySelector(config.submitButton) as HTMLElement;
        if (submitButton) {
          const textareaCheck = document.querySelector(config.textarea) as HTMLElement;
          const currentText = textareaCheck ? config.getMessageText(textareaCheck) : '';

          // Restore message if needed
          if ((!currentText || currentText.trim().length === 0) && messageText && textareaCheck) {
            setMessageText(textareaCheck, messageText, config);
          }

          submitButton.click();
        }
      }, 0);
    }
  } catch (e) {
    // Ignore selector errors
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

      // MONITORING MODE: Log and allow through immediately (no blocking, no UI)
      if (apiClient.isLogOnlyMode()) {
        apiClient.logMessage(messageText, config.name);  // Fire-and-forget
        return;  // Allow click to proceed naturally
      }

      // If we're allowing the next submit (user chose to send or send-redacted), let it through
      if (allowNextSubmit) {
        allowNextSubmit = false;
        return;
      }

      // Only intercept if not already processing
      if (isProcessingSubmit) {
        return;
      }

      // Prevent default submission
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Mark as processing
      isProcessingSubmit = true;

      // Show scanning overlay if server scanning is enabled
      let removeOverlay: (() => void) | null = null;
      if (apiClient.isConfigured()) {
        removeOverlay = showScanningOverlay();
      }

      try {
        // Run message text scanning (files are scanned on upload)
        const result = await performScan(messageText, config.name);

        // Remove scanning overlay
        if (removeOverlay) removeOverlay();

        // Handle the scan result
        const { action } = await handleScanResult(
          result,
          messageText,
          textarea,
          config,
        );

        if (action === 'block') {
          isProcessingSubmit = false;
          return;
        }

        stats.messagesSent++;

        // Allow the submission to proceed
        isProcessingSubmit = false;
        allowNextSubmit = true; // Set flag to skip our handler on next click

        // Trigger the actual click (this will trigger our handler again, but allowNextSubmit will let it through)
        button.click();
      } catch (error) {
        // Remove scanning overlay on error
        if (removeOverlay) removeOverlay();

        console.error('[Niyantra] Scan error:', error);

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
    await storageSet({ stats });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Load stats from storage
 */
async function loadStats() {
  try {
    const result = await storageGet(['stats']);
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

// Listen for settings updates from background
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'SETTINGS_CHANGED') {
    console.log('[Niyantra] Settings changed, reinitializing API client');
    // Reinitialize API client with new settings
    apiClient.updateSettings(message.serverUrl, message.apiKey).catch((err) => {
      console.error('[Niyantra] Failed to update settings:', err);
    });
  }
});

// Export for debugging
(window as any).__guardflow = {
  stats,
  fileStats: getFileStats,
  version: '2.0.0',
  isServerConfigured: () => apiClient.isConfigured(),
  serverUrl: () => apiClient.getServerUrl(),
};
