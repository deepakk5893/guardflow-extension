/**
 * Secret Warning Dialog
 * Shows a modal dialog when secrets are detected in the message
 */

import type { SecretDetectionResult, DetectedSecret } from '~/utils/secretDetection';
import { getSecretLine } from '~/utils/secretDetection';

type UserChoice = 'edit' | 'send-anyway' | 'cancel';

/**
 * Show warning dialog and return user's choice
 */
export function showSecretWarningDialog(
  result: SecretDetectionResult,
  messageText: string,
): Promise<UserChoice> {
  return new Promise((resolve) => {
    // Create dialog container
    const dialogContainer = createDialogContainer();

    // Create dialog content
    const dialog = createDialog(result, messageText, (choice: UserChoice) => {
      // Remove dialog
      document.body.removeChild(dialogContainer);
      resolve(choice);
    });

    dialogContainer.appendChild(dialog);
    document.body.appendChild(dialogContainer);

    // Focus the dialog
    setTimeout(() => {
      const editButton = dialog.querySelector('[data-action="edit"]') as HTMLElement;
      editButton?.focus();
    }, 100);
  });
}

/**
 * Create dialog container (backdrop)
 */
function createDialogContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'guardflow-dialog-container';
  container.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  `;
  return container;
}

/**
 * Create the actual dialog
 */
function createDialog(
  result: SecretDetectionResult,
  messageText: string,
  onChoice: (choice: UserChoice) => void,
): HTMLDivElement {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
  `;

  dialog.innerHTML = `
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 40px; height: 40px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
          Potential Secret Detected
        </h2>
      </div>
    </div>

    <div style="padding: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
        We found what appears to be sensitive information in your message:
      </p>

      <div style="margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px;">
        ${result.secrets.map((secret) => createSecretItem(secret, messageText)).join('')}
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #111827;">
          ⚠️ Security Warning
        </p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
          Sending secrets or API keys to AI models can be a security risk. These values may
          be stored in logs, used for training, or accidentally exposed.
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          We recommend removing or masking sensitive information before sending.
        </p>
      </div>
    </div>

    <div style="padding: 16px 24px; border-top: 1px solid: #e5e7eb; display: flex; flex-direction: column; gap: 8px;">
      <button
        data-action="edit"
        style="width: 100%; padding: 10px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit Message
      </button>

      <div style="display: flex; gap: 8px;">
        <button
          data-action="send-anyway"
          style="flex: 1; padding: 8px 16px; background: #fef3c7; color: #92400e; border: 1px solid #fde047; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          Send Anyway
        </button>
        <button
          data-action="cancel"
          style="flex: 1; padding: 8px 16px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Cancel
        </button>
      </div>
    </div>

    <div style="background: #f9fafb; padding: 12px 24px; border-top: 1px solid #e5e7eb; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        💡 Tip: You can use <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #374151;">[REDACTED]</code> or
        <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #374151;">****</code> to mask sensitive values
      </p>
    </div>
  `;

  // Attach event listeners
  const editButton = dialog.querySelector('[data-action="edit"]');
  const sendAnywayButton = dialog.querySelector('[data-action="send-anyway"]');
  const cancelButton = dialog.querySelector('[data-action="cancel"]');

  editButton?.addEventListener('click', () => onChoice('edit'));
  sendAnywayButton?.addEventListener('click', () => onChoice('send-anyway'));
  cancelButton?.addEventListener('click', () => onChoice('cancel'));

  // Add hover effects
  [editButton, sendAnywayButton, cancelButton].forEach((button) => {
    if (!button) return;
    const htmlButton = button as HTMLElement;

    htmlButton.addEventListener('mouseenter', () => {
      htmlButton.style.opacity = '0.9';
      htmlButton.style.transform = 'scale(0.98)';
    });

    htmlButton.addEventListener('mouseleave', () => {
      htmlButton.style.opacity = '1';
      htmlButton.style.transform = 'scale(1)';
    });
  });

  return dialog;
}

/**
 * Create HTML for a single secret item
 */
function createSecretItem(secret: DetectedSecret, messageText: string): string {
  const lineNumber = getSecretLine(messageText, secret);

  return `
    <div style="display: flex; align-items: start; gap: 12px; padding: 12px; background: #fef3c7; border: 1px solid #fde047; border-radius: 8px;">
      <div style="width: 20px; height: 20px; background: #fde047; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 13px; font-weight: 500; color: #92400e;">
            ${escapeHtml(secret.type)}
          </span>
          ${lineNumber > 1 ? `<span style="font-size: 11px; color: #92400e;">at line ${lineNumber}</span>` : ''}
        </div>
        <code style="display: block; padding: 6px 8px; background: #fef9c3; border-radius: 4px; font-size: 12px; font-family: 'Courier New', monospace; color: #713f12; word-break: break-all;">
          ${escapeHtml(secret.preview)}
        </code>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
