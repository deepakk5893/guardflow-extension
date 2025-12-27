/**
 * Secret Warning Dialog
 * Shows a modal dialog when secrets/PII are detected in the message
 *
 * Updated for server-side scanning with:
 * - No "Send Anyway" option (blocked for everyone)
 * - "Send Redacted" option when redacted text is available
 * - Loading overlay during server scan
 * - Support for server-detected PII
 */

import type { SecretDetectionResult } from '~/utils/secretDetection';
import type { PIIDetection } from './api-client';

// Updated user choice - no 'send-anyway' option
export type UserChoice = 'edit' | 'send-redacted' | 'cancel';

/**
 * Show scanning overlay while waiting for server response
 * Returns a function to remove the overlay
 */
export function showScanningOverlay(): () => void {
  const overlay = document.createElement('div');
  overlay.id = 'niyantra-scanning-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: white;
    padding: 32px 48px;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    text-align: center;
  `;

  // Spinner
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: niyantra-spin 0.8s linear infinite;
    margin: 0 auto 16px;
  `;

  // Add keyframes for spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes niyantra-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  const text = document.createElement('p');
  text.style.cssText = 'margin: 0; font-size: 16px; font-weight: 500; color: #374151;';
  text.textContent = 'Scanning for sensitive data...';

  const subtext = document.createElement('p');
  subtext.style.cssText = 'margin: 8px 0 0; font-size: 13px; color: #6b7280;';
  subtext.textContent = 'This helps protect your secrets and PII';

  card.appendChild(spinner);
  card.appendChild(text);
  card.appendChild(subtext);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  };
}

/**
 * Show warning dialog for local-only detection (backward compatible)
 */
export function showSecretWarningDialog(
  result: SecretDetectionResult,
  messageText: string,
): Promise<UserChoice> {
  // Convert local result to server-like format
  const detections: PIIDetection[] = result.secrets.map((secret) => ({
    type: secret.type,
    category: 'hard' as const,
    start: secret.index,
    end: secret.index + secret.length,
    preview: secret.preview,
    severity: secret.severity || 'high',
    confidence: 1.0,
  }));

  return showEnhancedWarningDialog(detections, messageText, undefined);
}

/**
 * Show enhanced warning dialog with server detection results (message + files)
 */
export function showEnhancedWarningDialog(
  detections: PIIDetection[],
  messageText: string,
  redactedText?: string,
  fileViolations?: Array<{
    filename: string;
    detections: PIIDetection[];
    redactedDocument?: string;
  }>,
): Promise<UserChoice> {
  return new Promise((resolve) => {
    const dialogContainer = createDialogContainer();
    const dialog = createEnhancedDialog(
      detections,
      messageText,
      redactedText,
      (choice: UserChoice) => {
        document.body.removeChild(dialogContainer);
        resolve(choice);
      },
      fileViolations
    );

    dialogContainer.appendChild(dialog);
    document.body.appendChild(dialogContainer);

    // Focus the first action button
    setTimeout(() => {
      const firstButton = dialog.querySelector('button') as HTMLElement;
      firstButton?.focus();
    }, 100);
  });
}

/**
 * Create dialog container (backdrop)
 */
function createDialogContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'niyantra-dialog-container';
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
 * Create enhanced dialog with server detection support (message + files)
 */
function createEnhancedDialog(
  detections: PIIDetection[],
  _messageText: string,
  redactedText: string | undefined,
  onChoice: (choice: UserChoice) => void,
  fileViolations?: Array<{
    filename: string;
    detections: PIIDetection[];
    redactedDocument?: string;
  }>,
): HTMLDivElement {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 560px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
  `;

  // Header with red/critical styling
  const header = document.createElement('div');
  header.style.cssText = 'padding: 24px; border-bottom: 1px solid #e5e7eb; background: #fef2f2; border-radius: 12px 12px 0 0;';

  const headerContent = document.createElement('div');
  headerContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';

  const icon = document.createElement('div');
  icon.style.cssText = 'width: 44px; height: 44px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center;';
  icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';

  const titleContainer = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #991b1b;';
  title.textContent = 'Sensitive Data Detected';

  const totalCount = detections.length + (fileViolations?.reduce((sum, fv) => sum + fv.detections.length, 0) || 0);
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'margin: 4px 0 0; font-size: 13px; color: #b91c1c;';
  subtitle.textContent = `${totalCount} item${totalCount > 1 ? 's' : ''} blocked`;

  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);
  headerContent.appendChild(icon);
  headerContent.appendChild(titleContainer);
  header.appendChild(headerContent);
  dialog.appendChild(header);

  // Main content
  const content = document.createElement('div');
  content.style.cssText = 'padding: 24px;';

  // Message violations (if any)
  if (detections.length > 0) {
    const description = document.createElement('p');
    description.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; font-weight: 500; color: #374151;';
    description.textContent = '📝 In your message:';
    content.appendChild(description);

    const detectionsContainer = document.createElement('div');
    detectionsContainer.style.cssText = 'margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto;';

    detections.forEach((detection) => {
      detectionsContainer.appendChild(createDetectionElement(detection));
    });
    content.appendChild(detectionsContainer);
  }

  // File violations (if any)
  if (fileViolations && fileViolations.length > 0) {
    fileViolations.forEach((fileViolation) => {
      const fileDescription = document.createElement('p');
      fileDescription.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; font-weight: 500; color: #374151;';
      fileDescription.textContent = `📄 In ${fileViolation.filename}:`;
      content.appendChild(fileDescription);

      const fileDetectionsContainer = document.createElement('div');
      fileDetectionsContainer.style.cssText = 'margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto;';

      fileViolation.detections.forEach((detection) => {
        fileDetectionsContainer.appendChild(createDetectionElement(detection));
      });
      content.appendChild(fileDetectionsContainer);
    });
  }

  // Redacted preview (if available)
  if (redactedText) {
    const previewSection = document.createElement('div');
    previewSection.style.cssText = 'margin-bottom: 20px;';

    const previewLabel = document.createElement('p');
    previewLabel.style.cssText = 'margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #374151;';
    previewLabel.textContent = 'Redacted version (click "Send Redacted" to use):';

    const previewBox = document.createElement('div');
    previewBox.style.cssText = `
      padding: 12px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      font-size: 13px;
      color: #166534;
      max-height: 120px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "Courier New", monospace;
    `;
    previewBox.textContent = redactedText.substring(0, 500) + (redactedText.length > 500 ? '...' : '');

    previewSection.appendChild(previewLabel);
    previewSection.appendChild(previewBox);
    content.appendChild(previewSection);
  }

  // Warning box
  const warningBox = document.createElement('div');
  warningBox.style.cssText = 'background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;';

  const warningContent = document.createElement('div');
  warningContent.innerHTML = `
    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #92400e;">
      Why is this blocked?
    </p>
    <p style="margin: 0; font-size: 13px; color: #78350f;">
      Sending secrets, API keys, or personal information to AI models is a security risk.
      This data may be stored in logs, used for training, or accidentally exposed.
      Your organization's policy requires this content to be removed or redacted.
    </p>
  `;
  warningBox.appendChild(warningContent);
  content.appendChild(warningBox);

  dialog.appendChild(content);

  // Buttons - NO "Send Anyway" option
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 8px;';

  const hasFileViolations = fileViolations && fileViolations.length > 0;
  const hasRedactedContent = redactedText || (fileViolations && fileViolations.some(fv => fv.redactedDocument));

  // Primary action: Send/Upload Redacted (if available)
  if (hasRedactedContent) {
    const sendRedactedButton = document.createElement('button');
    sendRedactedButton.setAttribute('data-action', 'send-redacted');
    sendRedactedButton.style.cssText = `
      width: 100%; padding: 12px 16px; background: #16a34a; color: white;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    `;
    sendRedactedButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
      <span>${hasFileViolations ? 'Upload Redacted Version' : 'Send Redacted Version'}</span>
    `;
    sendRedactedButton.addEventListener('click', () => onChoice('send-redacted'));
    addHoverEffect(sendRedactedButton);
    buttonContainer.appendChild(sendRedactedButton);
  }

  // Edit button - Only show if there are message violations (not for files only)
  if (detections.length > 0) {
    const editButton = document.createElement('button');
    editButton.setAttribute('data-action', 'edit');
    editButton.style.cssText = `
      width: 100%; padding: 10px 16px; background: ${hasRedactedContent ? 'white' : '#2563eb'};
      color: ${hasRedactedContent ? '#374151' : 'white'};
      border: ${hasRedactedContent ? '1px solid #d1d5db' : 'none'};
      border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    `;
    editButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      <span>Edit Message Manually</span>
    `;
    editButton.addEventListener('click', () => onChoice('edit'));
    addHoverEffect(editButton);
    buttonContainer.appendChild(editButton);
  }

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.setAttribute('data-action', 'cancel');
  cancelButton.style.cssText = `
    width: 100%; padding: 8px 16px; background: transparent; color: #6b7280;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 400;
    cursor: pointer; text-decoration: underline;
  `;
  cancelButton.textContent = 'Cancel and discard message';
  cancelButton.addEventListener('click', () => onChoice('cancel'));
  buttonContainer.appendChild(cancelButton);

  dialog.appendChild(buttonContainer);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = 'background: #f9fafb; padding: 12px 24px; border-top: 1px solid #e5e7eb; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;';

  const footerText = document.createElement('p');
  footerText.style.cssText = 'margin: 0; font-size: 11px; color: #9ca3af; text-align: center;';
  footerText.innerHTML = 'Protected by <strong>Niyantra</strong> - Enterprise AI Governance';
  footer.appendChild(footerText);
  dialog.appendChild(footer);

  return dialog;
}

/**
 * Create a DOM element for a single detection item
 */
function createDetectionElement(detection: PIIDetection): HTMLDivElement {
  const container = document.createElement('div');
  const isHard = detection.category === 'hard';

  container.style.cssText = `
    display: flex;
    align-items: start;
    gap: 10px;
    padding: 10px 12px;
    background: ${isHard ? '#fef2f2' : '#fffbeb'};
    border: 1px solid ${isHard ? '#fecaca' : '#fde68a'};
    border-radius: 8px;
  `;

  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 18px; height: 18px;
    background: ${isHard ? '#fecaca' : '#fde68a'};
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
  `;
  icon.innerHTML = isHard
    ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
    : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>';

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; min-width: 0;';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

  const type = document.createElement('span');
  type.style.cssText = `font-size: 12px; font-weight: 600; color: ${isHard ? '#991b1b' : '#92400e'};`;
  type.textContent = detection.type.replace(/_/g, ' ');

  const severity = document.createElement('span');
  severity.style.cssText = `
    font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 4px;
    background: ${isHard ? '#dc2626' : '#d97706'}; color: white; text-transform: uppercase;
  `;
  severity.textContent = detection.severity;

  if (detection.framework) {
    const framework = document.createElement('span');
    framework.style.cssText = 'font-size: 10px; color: #6b7280;';
    framework.textContent = detection.framework;
    header.appendChild(framework);
  }

  header.appendChild(type);
  header.appendChild(severity);

  const preview = document.createElement('code');
  preview.style.cssText = `
    display: block;
    margin-top: 4px;
    padding: 4px 6px;
    background: ${isHard ? '#fee2e2' : '#fef3c7'};
    border-radius: 4px;
    font-size: 11px;
    font-family: "Courier New", monospace;
    color: ${isHard ? '#7f1d1d' : '#713f12'};
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  `;
  preview.textContent = detection.preview || '***';

  content.appendChild(header);
  content.appendChild(preview);

  container.appendChild(icon);
  container.appendChild(content);

  return container;
}

/**
 * Add hover effect to button
 */
function addHoverEffect(button: HTMLButtonElement): void {
  button.addEventListener('mouseenter', () => {
    button.style.opacity = '0.9';
    button.style.transform = 'translateY(-1px)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.opacity = '1';
    button.style.transform = 'translateY(0)';
  });
}

/**
 * Legacy function - kept for backward compatibility
 */
function createSecretItemElement(secret: { type: string; preview: string; index: number; length: number; severity?: string }, _messageText: string): HTMLDivElement {
  const detection: PIIDetection = {
    type: secret.type,
    category: 'hard',
    start: secret.index,
    end: secret.index + secret.length,
    preview: secret.preview,
    severity: secret.severity || 'high',
    confidence: 1.0,
  };
  return createDetectionElement(detection);
}

export { createSecretItemElement };
