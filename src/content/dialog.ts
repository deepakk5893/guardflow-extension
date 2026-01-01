/**
 * Secret Warning Dialog
 * Shows a modal dialog when secrets/PII are detected in the message
 *
 * Updated for three-tier PII classification:
 * - CRITICAL: Red, never allow bypass (API keys, Aadhaar, phone, email)
 * - SENSITIVE: Orange, admin configurable bypass (passport, IP)
 * - CONTEXTUAL: Yellow, allow bypass with logging (names, organizations)
 */

import type { SecretDetectionResult } from '~/utils/secretDetection';
import type { PIIDetection, PIITier, OverrideConfig } from './api-client';

// Updated user choice - includes 'send-anyway' option
export type UserChoice = 'edit' | 'send-redacted' | 'send-anyway' | 'cancel';

// Override result returned when user clicks "Send Anyway"
export interface OverrideResult {
  choice: 'send-anyway';
  reason?: string;
  overriddenDetections: PIIDetection[];
}

// Tier styling configuration
const TIER_STYLES = {
  critical: {
    bg: '#fef2f2',
    border: '#fecaca',
    iconBg: '#fecaca',
    iconColor: '#dc2626',
    textColor: '#991b1b',
    badgeColor: '#dc2626',
    label: 'CRITICAL',
    description: 'Cannot bypass - security policy',
  },
  sensitive: {
    bg: '#fff7ed',
    border: '#fed7aa',
    iconBg: '#fed7aa',
    iconColor: '#ea580c',
    textColor: '#9a3412',
    badgeColor: '#ea580c',
    label: 'SENSITIVE',
    description: 'Admin approval may be required',
  },
  contextual: {
    bg: '#fefce8',
    border: '#fef08a',
    iconBg: '#fef08a',
    iconColor: '#ca8a04',
    textColor: '#854d0e',
    badgeColor: '#ca8a04',
    label: 'CONTEXTUAL',
    description: 'Can bypass with reason',
  },
} as const;

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
): Promise<UserChoice | OverrideResult> {
  // Convert local result to server-like format
  const detections: PIIDetection[] = result.secrets.map((secret) => ({
    type: secret.type,
    category: 'hard' as const,
    tier: 'critical' as PIITier,
    start: secret.index,
    end: secret.index + secret.length,
    preview: secret.preview,
    severity: secret.severity || 'high',
    confidence: 1.0,
    allow_override: false,
  }));

  return showEnhancedWarningDialog(detections, messageText, undefined);
}

/**
 * Show enhanced warning dialog with server detection results (message + files)
 * Now supports three-tier PII classification and "Send Anyway" option
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
  overrideConfig?: OverrideConfig,
): Promise<UserChoice | OverrideResult> {
  return new Promise((resolve) => {
    const dialogContainer = createDialogContainer();
    const dialog = createEnhancedDialog(
      detections,
      messageText,
      redactedText,
      (choice: UserChoice | OverrideResult) => {
        document.body.removeChild(dialogContainer);
        resolve(choice);
      },
      fileViolations,
      overrideConfig
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
 * Group detections by tier for organized display
 */
function groupDetectionsByTier(detections: PIIDetection[]): Record<PIITier, PIIDetection[]> {
  const grouped: Record<PIITier, PIIDetection[]> = {
    critical: [],
    sensitive: [],
    contextual: [],
  };

  for (const detection of detections) {
    const tier = detection.tier || 'critical';
    grouped[tier].push(detection);
  }

  return grouped;
}

/**
 * Create enhanced dialog with three-tier PII classification
 */
function createEnhancedDialog(
  detections: PIIDetection[],
  _messageText: string,
  redactedText: string | undefined,
  onChoice: (choice: UserChoice | OverrideResult) => void,
  fileViolations?: Array<{
    filename: string;
    detections: PIIDetection[];
    redactedDocument?: string;
  }>,
  overrideConfig?: OverrideConfig,
): HTMLDivElement {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
  `;

  // Determine header style based on most severe tier present
  const allDetections = [
    ...detections,
    ...(fileViolations?.flatMap(fv => fv.detections) || [])
  ];
  const hasCritical = allDetections.some(d => (d.tier || 'critical') === 'critical');
  const hasSensitive = allDetections.some(d => d.tier === 'sensitive');
  const hasOverridable = allDetections.some(d => d.allow_override);

  // Header styling based on most severe tier
  const headerBg = hasCritical ? '#fef2f2' : (hasSensitive ? '#fff7ed' : '#fefce8');
  const headerIconBg = hasCritical ? '#fee2e2' : (hasSensitive ? '#fed7aa' : '#fef08a');
  const headerIconColor = hasCritical ? '#dc2626' : (hasSensitive ? '#ea580c' : '#ca8a04');
  const headerTextColor = hasCritical ? '#991b1b' : (hasSensitive ? '#9a3412' : '#854d0e');
  const headerSubColor = hasCritical ? '#b91c1c' : (hasSensitive ? '#c2410c' : '#a16207');

  // Header
  const header = document.createElement('div');
  header.style.cssText = `padding: 24px; border-bottom: 1px solid #e5e7eb; background: ${headerBg}; border-radius: 12px 12px 0 0;`;

  const headerContent = document.createElement('div');
  headerContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';

  const icon = document.createElement('div');
  icon.style.cssText = `width: 44px; height: 44px; background: ${headerIconBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center;`;
  icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${headerIconColor}" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

  const titleContainer = document.createElement('div');
  const title = document.createElement('h2');
  title.style.cssText = `margin: 0; font-size: 18px; font-weight: 600; color: ${headerTextColor};`;
  title.textContent = 'Sensitive Data Detected';

  const totalCount = allDetections.length;
  const subtitle = document.createElement('p');
  subtitle.style.cssText = `margin: 4px 0 0; font-size: 13px; color: ${headerSubColor};`;
  subtitle.textContent = `${totalCount} item${totalCount > 1 ? 's' : ''} detected`;

  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);
  headerContent.appendChild(icon);
  headerContent.appendChild(titleContainer);
  header.appendChild(headerContent);
  dialog.appendChild(header);

  // Main content
  const content = document.createElement('div');
  content.style.cssText = 'padding: 24px;';

  // Group and display message detections by tier
  if (detections.length > 0) {
    const description = document.createElement('p');
    description.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; font-weight: 500; color: #374151;';
    description.textContent = '📝 In your message:';
    content.appendChild(description);

    const groupedDetections = groupDetectionsByTier(detections);

    // Display tiers in order: critical, sensitive, contextual
    const tierOrder: PIITier[] = ['critical', 'sensitive', 'contextual'];
    for (const tier of tierOrder) {
      const tierDetections = groupedDetections[tier];
      if (tierDetections.length > 0) {
        content.appendChild(createTierSection(tier, tierDetections));
      }
    }
  }

  // File violations (if any)
  if (fileViolations && fileViolations.length > 0) {
    fileViolations.forEach((fileViolation) => {
      const fileDescription = document.createElement('p');
      fileDescription.style.cssText = 'margin: 16px 0 16px 0; font-size: 14px; font-weight: 500; color: #374151;';
      fileDescription.textContent = `📄 In ${fileViolation.filename}:`;
      content.appendChild(fileDescription);

      const groupedFileDetections = groupDetectionsByTier(fileViolation.detections);
      const tierOrder: PIITier[] = ['critical', 'sensitive', 'contextual'];
      for (const tier of tierOrder) {
        const tierDetections = groupedFileDetections[tier];
        if (tierDetections.length > 0) {
          content.appendChild(createTierSection(tier, tierDetections));
        }
      }
    });
  }

  // Redacted preview (if available)
  if (redactedText) {
    const previewSection = document.createElement('div');
    previewSection.style.cssText = 'margin: 20px 0;';

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

  // Override reason input (if overridable and reason required)
  let reasonInput: HTMLTextAreaElement | null = null;
  if (hasOverridable && overrideConfig?.has_overridable_detections) {
    const overrideSection = document.createElement('div');
    overrideSection.style.cssText = 'margin: 20px 0; padding: 16px; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px;';

    const overrideLabel = document.createElement('p');
    overrideLabel.style.cssText = 'margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #854d0e;';
    overrideLabel.innerHTML = '⚠️ Some detections can be bypassed';

    const overrideDesc = document.createElement('p');
    overrideDesc.style.cssText = 'margin: 0 0 12px 0; font-size: 12px; color: #a16207;';
    overrideDesc.textContent = 'Contextual data (like names, organizations) can be sent with "Send Anyway". This will be logged for audit.';

    overrideSection.appendChild(overrideLabel);
    overrideSection.appendChild(overrideDesc);

    if (overrideConfig?.require_reason) {
      const reasonLabel = document.createElement('label');
      reasonLabel.style.cssText = 'display: block; margin: 0 0 6px 0; font-size: 12px; font-weight: 500; color: #854d0e;';
      reasonLabel.textContent = 'Reason for bypass (required):';
      reasonLabel.setAttribute('for', 'niyantra-override-reason');

      reasonInput = document.createElement('textarea');
      reasonInput.id = 'niyantra-override-reason';
      reasonInput.placeholder = 'Why are you sending this data?';
      reasonInput.style.cssText = `
        width: 100%;
        min-height: 60px;
        padding: 8px 12px;
        border: 1px solid #fde68a;
        border-radius: 6px;
        font-size: 13px;
        resize: vertical;
        box-sizing: border-box;
      `;

      overrideSection.appendChild(reasonLabel);
      overrideSection.appendChild(reasonInput);
    }

    content.appendChild(overrideSection);
  }

  // Warning box for critical/blocked items
  if (hasCritical) {
    const warningBox = document.createElement('div');
    warningBox.style.cssText = 'background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 16px;';

    const warningContent = document.createElement('div');
    warningContent.innerHTML = `
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #991b1b;">
        🔒 Critical items cannot be bypassed
      </p>
      <p style="margin: 0; font-size: 13px; color: #b91c1c;">
        API keys, secrets, and personal identifiers like Aadhaar, phone numbers, and emails
        are blocked by security policy. Use "Send Redacted" or edit your message.
      </p>
    `;
    warningBox.appendChild(warningContent);
    content.appendChild(warningBox);
  }

  dialog.appendChild(content);

  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 8px;';

  const hasFileViolations = fileViolations && fileViolations.length > 0;
  const hasRedactedContent = redactedText || (fileViolations && fileViolations.some(fv => fv.redactedDocument));

  // Collect overridable detections for "Send Anyway"
  const overridableDetections = allDetections.filter(d => d.allow_override);
  const canSendAnyway = overridableDetections.length > 0 &&
    overrideConfig?.has_overridable_detections &&
    !hasCritical; // Don't show "Send Anyway" if there are critical items

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

  // "Send Anyway" button (only for contextual/sensitive overridable items, no critical)
  if (canSendAnyway) {
    const sendAnywayButton = document.createElement('button');
    sendAnywayButton.setAttribute('data-action', 'send-anyway');
    sendAnywayButton.style.cssText = `
      width: 100%; padding: 10px 16px; background: #fef3c7; color: #92400e;
      border: 1px solid #fde68a; border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    `;
    sendAnywayButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <span>Send Anyway (${overridableDetections.length} item${overridableDetections.length > 1 ? 's' : ''} will be logged)</span>
    `;
    sendAnywayButton.addEventListener('click', () => {
      // Check if reason is required and provided
      if (overrideConfig?.require_reason && reasonInput) {
        const reason = reasonInput.value.trim();
        if (!reason) {
          reasonInput.style.borderColor = '#dc2626';
          reasonInput.focus();
          return;
        }
        onChoice({
          choice: 'send-anyway',
          reason,
          overriddenDetections: overridableDetections,
        });
      } else {
        onChoice({
          choice: 'send-anyway',
          reason: reasonInput?.value.trim() || undefined,
          overriddenDetections: overridableDetections,
        });
      }
    });
    addHoverEffect(sendAnywayButton);
    buttonContainer.appendChild(sendAnywayButton);
  }

  // Edit button - Only show if there are message violations (not for files only)
  if (detections.length > 0) {
    const editButton = document.createElement('button');
    editButton.setAttribute('data-action', 'edit');
    editButton.style.cssText = `
      width: 100%; padding: 10px 16px; background: ${hasRedactedContent || canSendAnyway ? 'white' : '#2563eb'};
      color: ${hasRedactedContent || canSendAnyway ? '#374151' : 'white'};
      border: ${hasRedactedContent || canSendAnyway ? '1px solid #d1d5db' : 'none'};
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
 * Create a section for a specific tier of detections
 */
function createTierSection(tier: PIITier, detections: PIIDetection[]): HTMLDivElement {
  const style = TIER_STYLES[tier];

  const section = document.createElement('div');
  section.style.cssText = `margin-bottom: 16px;`;

  // Tier header
  const tierHeader = document.createElement('div');
  tierHeader.style.cssText = `
    display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    padding: 6px 10px; background: ${style.bg}; border-radius: 6px;
  `;

  const tierBadge = document.createElement('span');
  tierBadge.style.cssText = `
    font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
    background: ${style.badgeColor}; color: white; text-transform: uppercase; letter-spacing: 0.5px;
  `;
  tierBadge.textContent = style.label;

  const tierDesc = document.createElement('span');
  tierDesc.style.cssText = `font-size: 11px; color: ${style.textColor};`;
  tierDesc.textContent = style.description;

  tierHeader.appendChild(tierBadge);
  tierHeader.appendChild(tierDesc);
  section.appendChild(tierHeader);

  // Detection items
  const detectionsContainer = document.createElement('div');
  detectionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;';

  detections.forEach((detection) => {
    detectionsContainer.appendChild(createDetectionElement(detection));
  });

  section.appendChild(detectionsContainer);
  return section;
}

/**
 * Create a DOM element for a single detection item
 */
function createDetectionElement(detection: PIIDetection): HTMLDivElement {
  const tier = detection.tier || 'critical';
  const style = TIER_STYLES[tier];

  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    align-items: start;
    gap: 10px;
    padding: 10px 12px;
    background: ${style.bg};
    border: 1px solid ${style.border};
    border-radius: 8px;
  `;

  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 18px; height: 18px;
    background: ${style.iconBg};
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
  `;

  // Different icons per tier
  if (tier === 'critical') {
    icon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${style.iconColor}" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  } else if (tier === 'sensitive') {
    icon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${style.iconColor}" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>`;
  } else {
    icon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${style.iconColor}" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }

  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = 'flex: 1; min-width: 0;';

  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

  const type = document.createElement('span');
  type.style.cssText = `font-size: 12px; font-weight: 600; color: ${style.textColor};`;
  type.textContent = detection.type.replace(/_/g, ' ');

  const severity = document.createElement('span');
  severity.style.cssText = `
    font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 4px;
    background: ${style.badgeColor}; color: white; text-transform: uppercase;
  `;
  severity.textContent = detection.severity;

  // Show "Can bypass" indicator for overridable items
  if (detection.allow_override) {
    const bypassBadge = document.createElement('span');
    bypassBadge.style.cssText = `
      font-size: 9px; font-weight: 500; padding: 2px 6px; border-radius: 4px;
      background: #d1fae5; color: #047857; text-transform: uppercase;
    `;
    bypassBadge.textContent = 'CAN BYPASS';
    headerDiv.appendChild(bypassBadge);
  }

  if (detection.framework) {
    const framework = document.createElement('span');
    framework.style.cssText = 'font-size: 10px; color: #6b7280;';
    framework.textContent = detection.framework;
    headerDiv.appendChild(framework);
  }

  headerDiv.appendChild(type);
  headerDiv.appendChild(severity);

  const preview = document.createElement('code');
  preview.style.cssText = `
    display: block;
    margin-top: 4px;
    padding: 4px 6px;
    background: ${tier === 'critical' ? '#fee2e2' : (tier === 'sensitive' ? '#fed7aa' : '#fef9c3')};
    border-radius: 4px;
    font-size: 11px;
    font-family: "Courier New", monospace;
    color: ${style.textColor};
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  `;
  preview.textContent = detection.preview || '***';

  contentDiv.appendChild(headerDiv);
  contentDiv.appendChild(preview);

  container.appendChild(icon);
  container.appendChild(contentDiv);

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
    tier: 'critical',
    start: secret.index,
    end: secret.index + secret.length,
    preview: secret.preview,
    severity: secret.severity || 'high',
    confidence: 1.0,
    allow_override: false,
  };
  return createDetectionElement(detection);
}

export { createSecretItemElement };
