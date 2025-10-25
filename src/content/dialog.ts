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

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'padding: 24px; border-bottom: 1px solid #e5e7eb;';

  const headerContent = document.createElement('div');
  headerContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';

  const icon = document.createElement('div');
  icon.style.cssText = 'width: 40px; height: 40px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;';
  icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

  const title = document.createElement('h2');
  title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #111827;';
  title.textContent = 'Potential Secret Detected';

  headerContent.appendChild(icon);
  headerContent.appendChild(title);
  header.appendChild(headerContent);
  dialog.appendChild(header);

  // Main content
  const content = document.createElement('div');
  content.style.cssText = 'padding: 24px;';

  const description = document.createElement('p');
  description.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #6b7280;';
  description.textContent = 'We found what appears to be sensitive information in your message:';
  content.appendChild(description);

  // Secrets list
  const secretsContainer = document.createElement('div');
  secretsContainer.style.cssText = 'margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px;';
  result.secrets.forEach((secret) => {
    secretsContainer.appendChild(createSecretItemElement(secret, messageText));
  });
  content.appendChild(secretsContainer);

  // Warning box
  const warningBox = document.createElement('div');
  warningBox.style.cssText = 'background: #f9fafb; border-radius: 8px; padding: 16px;';

  const warningTitle = document.createElement('p');
  warningTitle.style.cssText = 'margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #111827;';
  warningTitle.textContent = '⚠️ Security Warning';

  const warningText1 = document.createElement('p');
  warningText1.style.cssText = 'margin: 0 0 8px 0; font-size: 13px; color: #6b7280;';
  warningText1.textContent = 'Sending secrets or API keys to AI models can be a security risk. These values may be stored in logs, used for training, or accidentally exposed.';

  const warningText2 = document.createElement('p');
  warningText2.style.cssText = 'margin: 0; font-size: 13px; color: #6b7280;';
  warningText2.textContent = 'We recommend removing or masking sensitive information before sending.';

  warningBox.appendChild(warningTitle);
  warningBox.appendChild(warningText1);
  warningBox.appendChild(warningText2);
  content.appendChild(warningBox);

  dialog.appendChild(content);

  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 8px;';

  const editButton = document.createElement('button');
  editButton.setAttribute('data-action', 'edit');
  editButton.style.cssText = 'width: 100%; padding: 10px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
  editButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Edit Message</span>';

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 8px;';

  const sendAnywayButton = document.createElement('button');
  sendAnywayButton.setAttribute('data-action', 'send-anyway');
  sendAnywayButton.style.cssText = 'flex: 1; padding: 8px 16px; background: #fef3c7; color: #92400e; border: 1px solid #fde047; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
  sendAnywayButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg><span>Send Anyway</span>';

  const cancelButton = document.createElement('button');
  cancelButton.setAttribute('data-action', 'cancel');
  cancelButton.style.cssText = 'flex: 1; padding: 8px 16px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
  cancelButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>Cancel</span>';

  buttonRow.appendChild(sendAnywayButton);
  buttonRow.appendChild(cancelButton);

  buttonContainer.appendChild(editButton);
  buttonContainer.appendChild(buttonRow);
  dialog.appendChild(buttonContainer);

  // Footer tip
  const footer = document.createElement('div');
  footer.style.cssText = 'background: #f9fafb; padding: 12px 24px; border-top: 1px solid #e5e7eb; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;';

  const tipText = document.createElement('p');
  tipText.style.cssText = 'margin: 0; font-size: 12px; color: #6b7280;';
  tipText.textContent = '💡 Tip: You can use [REDACTED] or **** to mask sensitive values';
  footer.appendChild(tipText);
  dialog.appendChild(footer);

  // Attach event listeners
  editButton.addEventListener('click', () => onChoice('edit'));
  sendAnywayButton.addEventListener('click', () => onChoice('send-anyway'));
  cancelButton.addEventListener('click', () => onChoice('cancel'));

  // Add hover effects
  [editButton, sendAnywayButton, cancelButton].forEach((button) => {
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '0.9';
      button.style.transform = 'scale(0.98)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.opacity = '1';
      button.style.transform = 'scale(1)';
    });
  });

  return dialog;
}

/**
 * Create a DOM element for a single secret item
 */
function createSecretItemElement(secret: DetectedSecret, messageText: string): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; align-items: start; gap: 12px; padding: 12px; background: #fef3c7; border: 1px solid #fde047; border-radius: 8px;';

  const icon = document.createElement('div');
  icon.style.cssText = 'width: 20px; height: 20px; background: #fde047; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;';
  icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1;';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

  const type = document.createElement('span');
  type.style.cssText = 'font-size: 13px; font-weight: 500; color: #92400e;';
  type.textContent = secret.type;
  header.appendChild(type);

  const lineNumber = getSecretLine(messageText, secret);
  if (lineNumber > 1) {
    const lineSpan = document.createElement('span');
    lineSpan.style.cssText = 'font-size: 11px; color: #92400e;';
    lineSpan.textContent = `at line ${lineNumber}`;
    header.appendChild(lineSpan);
  }

  const code = document.createElement('code');
  code.style.cssText = 'display: block; padding: 6px 8px; background: #fef9c3; border-radius: 4px; font-size: 12px; font-family: "Courier New", monospace; color: #713f12; word-break: break-all;';
  code.textContent = secret.preview;

  content.appendChild(header);
  content.appendChild(code);

  container.appendChild(icon);
  container.appendChild(content);

  return container;
}

