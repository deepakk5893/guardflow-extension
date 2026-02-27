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
import type { PIIDetection, PIITier, OverrideConfig, TokenInfo, TierAction } from './api-client';

// Updated user choice - includes 'send-anyway' option
export type UserChoice = 'edit' | 'send-redacted' | 'send-anyway' | 'cancel';

// Override result returned when user clicks "Send Anyway"
export interface OverrideResult {
  choice: 'send-anyway';
  overrideReasonCategory?: string;  // "false_detection", "test_data", "public_info", "other"
  reason?: string;                   // Custom text when category is "other"
  overriddenDetections: PIIDetection[];
}

/**
 * Show scanning overlay while waiting for server response
 * Returns a function to remove the overlay
 * Shows progress messages for longer scans to indicate the extension isn't stuck
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
    min-width: 280px;
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

  // Progress messages for longer scans - so user knows extension isn't stuck
  const progressMessages = [
    { delay: 5000, message: 'Processing document...', subMessage: 'Large files may take a moment' },
    { delay: 10000, message: 'Still scanning...', subMessage: 'Extracting text and checking for PII' },
    { delay: 20000, message: 'Almost done...', subMessage: 'Analyzing detected content' },
  ];

  const timeouts: number[] = [];
  progressMessages.forEach(({ delay, message, subMessage }) => {
    const timeoutId = window.setTimeout(() => {
      if (overlay.parentNode) {
        text.textContent = message;
        subtext.textContent = subMessage;
      }
    }, delay);
    timeouts.push(timeoutId);
  });

  return () => {
    // Clear all progress timeouts
    timeouts.forEach(id => window.clearTimeout(id));

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
  tokenMap?: Record<string, TokenInfo>,
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
      overrideConfig,
      tokenMap,
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
 * Create highlighted text with PII spans marked
 */
function createHighlightedText(
  messageText: string,
  detections: PIIDetection[],
): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = `
    padding: 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    color: #1f2937;
    max-height: 150px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: "Courier New", monospace;
    line-height: 1.5;
  `;

  // Sort detections by start position ascending
  const sorted = [...detections]
    .filter(d => d.start !== undefined && d.end !== undefined)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    container.textContent = messageText;
    return container;
  }

  // Merge overlapping spans
  const merged: Array<{ start: number; end: number; tier: PIITier }> = [];
  for (const det of sorted) {
    const tier = det.tier || 'critical';
    if (merged.length > 0 && det.start <= merged[merged.length - 1].end) {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, det.end);
      // Use most severe tier
      const tierPriority: Record<PIITier, number> = { critical: 0, sensitive: 1, contextual: 2 };
      if (tierPriority[tier] < tierPriority[last.tier]) {
        last.tier = tier;
      }
    } else {
      merged.push({ start: det.start, end: det.end, tier });
    }
  }

  // Build fragments
  let cursor = 0;
  const markColors: Record<PIITier, string> = {
    critical: '#fee2e2',
    sensitive: '#fed7aa',
    contextual: '#fef9c3',
  };
  const markBorders: Record<PIITier, string> = {
    critical: '#fca5a5',
    sensitive: '#fdba74',
    contextual: '#fde047',
  };

  for (const span of merged) {
    // Text before this span
    if (span.start > cursor) {
      container.appendChild(document.createTextNode(messageText.slice(cursor, span.start)));
    }
    // Highlighted span
    const mark = document.createElement('mark');
    mark.style.cssText = `
      background: ${markColors[span.tier]};
      border-bottom: 2px solid ${markBorders[span.tier]};
      border-radius: 2px;
      padding: 1px 2px;
    `;
    mark.textContent = messageText.slice(span.start, span.end);
    container.appendChild(mark);
    cursor = span.end;
  }
  // Remaining text
  if (cursor < messageText.length) {
    container.appendChild(document.createTextNode(messageText.slice(cursor)));
  }

  return container;
}

/**
 * Create compact detection list — single-row items instead of full cards
 */
function createCompactDetectionList(detections: PIIDetection[]): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = `
    margin-top: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    max-height: 140px;
    overflow-y: auto;
  `;

  const tierDots: Record<PIITier, string> = {
    critical: '#dc2626',
    sensitive: '#ea580c',
    contextual: '#ca8a04',
  };

  detections.forEach((detection, index) => {
    const tier = detection.tier || 'critical';
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};
      ${index < detections.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}
    `;

    // Tier dot
    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 8px; height: 8px;
      background: ${tierDots[tier]};
      border-radius: 50%;
      flex-shrink: 0;
    `;
    row.appendChild(dot);

    // Type name
    const typeName = document.createElement('span');
    typeName.style.cssText = 'font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap;';
    typeName.textContent = detection.type.replace(/_/g, ' ');
    row.appendChild(typeName);

    // Preview
    const preview = document.createElement('code');
    preview.style.cssText = `
      flex: 1; min-width: 0;
      font-size: 11px;
      font-family: "Courier New", monospace;
      color: #6b7280;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    preview.textContent = detection.preview || '***';
    row.appendChild(preview);

    // Framework badge
    if (detection.framework) {
      const badge = document.createElement('span');
      badge.style.cssText = `
        font-size: 9px; color: #9ca3af; font-weight: 500;
        padding: 1px 5px; background: #f3f4f6; border-radius: 3px;
        white-space: nowrap; flex-shrink: 0;
      `;
      badge.textContent = detection.framework;
      row.appendChild(badge);
    }

    container.appendChild(row);
  });

  return container;
}

/**
 * Create enhanced dialog with tab-based compact layout
 */
function createEnhancedDialog(
  detections: PIIDetection[],
  messageText: string,
  redactedText: string | undefined,
  onChoice: (choice: UserChoice | OverrideResult) => void,
  fileViolations?: Array<{
    filename: string;
    detections: PIIDetection[];
    redactedDocument?: string;
  }>,
  overrideConfig?: OverrideConfig,
  tokenMap?: Record<string, TokenInfo>,
): HTMLDivElement {
  // --- Setup ---
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  const allDetections = [
    ...detections,
    ...(fileViolations?.flatMap(fv => fv.detections) || []),
  ];
  const hasCritical = allDetections.some(d => (d.tier || 'critical') === 'critical');
  const hasSensitive = allDetections.some(d => d.tier === 'sensitive');
  const hasFileViolations = fileViolations && fileViolations.length > 0;
  const hasRedactedContent = redactedText || (fileViolations && fileViolations.some(fv => fv.redactedDocument));

  // Helper: get effective tier action (backward compat with old servers)
  const effectiveTierAction = (d: PIIDetection): TierAction => {
    if (d.tier_action) return d.tier_action;
    if (!d.allow_override) return 'block';
    const tier = d.tier || 'critical';
    if (overrideConfig?.require_reason_tiers?.includes(tier as PIITier)) return 'block_with_override';
    return 'warn';
  };

  // Classify detections by tier action
  const hasBlockOnly = allDetections.some(d => effectiveTierAction(d) === 'block');
  const hasBlockWithOverride = allDetections.some(d => effectiveTierAction(d) === 'block_with_override');
  const hasWarn = allDetections.some(d => effectiveTierAction(d) === 'warn');

  // Tab visibility: show Original tab only if there are overridable detections AND no hard-block
  const showOriginalTab = !hasBlockOnly && (hasBlockWithOverride || hasWarn);
  const showTabs = !!hasRedactedContent && showOriginalTab;

  // Override logic
  const overridableDetections = allDetections.filter(d => {
    const action = effectiveTierAction(d);
    return action === 'block_with_override' || action === 'warn';
  });
  const canSendAnyway = showOriginalTab && overridableDetections.length > 0;
  const requiresReason = canSendAnyway && hasBlockWithOverride;

  let selectedReasonCategory: string | null = null;
  let customReasonInput: HTMLInputElement | null = null;
  let activeTab: 'redacted' | 'original' = (showTabs || (hasRedactedContent && hasBlockOnly)) ? 'redacted' : 'original';

  // Header colors
  const headerBg = hasCritical ? '#fef2f2' : (hasSensitive ? '#fff7ed' : '#fefce8');
  const headerIconColor = hasCritical ? '#dc2626' : (hasSensitive ? '#ea580c' : '#ca8a04');
  const headerTextColor = hasCritical ? '#991b1b' : (hasSensitive ? '#9a3412' : '#854d0e');
  const headerSubColor = hasCritical ? '#b91c1c' : (hasSensitive ? '#c2410c' : '#a16207');

  // ==================== HEADER (fixed) ====================
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px;
    background: ${headerBg};
    border-radius: 12px 12px 0 0;
    flex-shrink: 0;
  `;

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

  // Warning icon
  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 36px; height: 36px;
    background: ${hasCritical ? '#fee2e2' : (hasSensitive ? '#fed7aa' : '#fef08a')};
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  `;
  icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${headerIconColor}" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

  // Title + inline badges
  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'flex: 1; min-width: 0;';

  const title = document.createElement('h2');
  title.style.cssText = `margin: 0; font-size: 16px; font-weight: 600; color: ${headerTextColor};`;
  title.textContent = 'Sensitive Data Detected';

  // Inline detection badges
  const badgeLine = document.createElement('div');
  badgeLine.style.cssText = `margin-top: 4px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 12px; color: ${headerSubColor};`;

  const tierDotColors: Record<PIITier, string> = {
    critical: '#dc2626',
    sensitive: '#ea580c',
    contextual: '#ca8a04',
  };

  // Deduplicate detection types and build inline badges
  const seenTypes = new Set<string>();
  const badgeParts: Array<{ type: string; tier: PIITier }> = [];
  for (const det of allDetections) {
    const key = det.type;
    if (!seenTypes.has(key)) {
      seenTypes.add(key);
      badgeParts.push({ type: det.type, tier: det.tier || 'critical' });
    }
  }

  const countSpan = document.createElement('span');
  countSpan.style.cssText = 'font-weight: 500;';
  countSpan.textContent = `${allDetections.length} item${allDetections.length > 1 ? 's' : ''}:`;
  badgeLine.appendChild(countSpan);

  badgeParts.forEach((bp, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.style.cssText = 'color: #d1d5db; margin: 0 1px;';
      sep.textContent = '\u00b7';
      badgeLine.appendChild(sep);
    }
    const dot = document.createElement('span');
    dot.style.cssText = `
      display: inline-block; width: 7px; height: 7px;
      background: ${tierDotColors[bp.tier]};
      border-radius: 50; margin-right: 2px;
    `;
    badgeLine.appendChild(dot);
    const label = document.createElement('span');
    label.textContent = bp.type.replace(/_/g, ' ').toUpperCase();
    badgeLine.appendChild(label);
  });

  titleWrap.appendChild(title);
  titleWrap.appendChild(badgeLine);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.style.cssText = `
    width: 28px; height: 28px;
    background: none; border: none;
    cursor: pointer; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    color: ${headerTextColor}; font-size: 18px; flex-shrink: 0;
  `;
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(0,0,0,0.08)'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'none'; });
  closeBtn.addEventListener('click', () => onChoice('cancel'));

  headerRow.appendChild(icon);
  headerRow.appendChild(titleWrap);
  headerRow.appendChild(closeBtn);
  header.appendChild(headerRow);
  dialog.appendChild(header);

  // ==================== TAB BAR (fixed, conditional) ====================
  let redactedTabBtn: HTMLButtonElement | null = null;
  let originalTabBtn: HTMLButtonElement | null = null;

  if (showTabs) {
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
      flex-shrink: 0;
      border-bottom: 1px solid #e5e7eb;
      padding: 0 20px;
      display: flex;
      gap: 0;
      background: white;
    `;

    const makeTab = (label: string, isActive: boolean): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = `
        padding: 10px 16px;
        border: none;
        background: none;
        font-size: 13px;
        font-weight: ${isActive ? '600' : '400'};
        color: ${isActive ? '#111827' : '#6b7280'};
        cursor: pointer;
        border-bottom: 2px solid ${isActive ? '#6366f1' : 'transparent'};
        transition: all 0.15s ease;
      `;
      btn.addEventListener('mouseenter', () => {
        if (btn.style.borderBottomColor === 'transparent') {
          btn.style.color = '#374151';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.style.borderBottomColor === 'transparent') {
          btn.style.color = '#6b7280';
        }
      });
      return btn;
    };

    redactedTabBtn = makeTab('Redacted', true);
    originalTabBtn = makeTab('Original', false);

    tabBar.appendChild(redactedTabBtn);
    tabBar.appendChild(originalTabBtn);
    dialog.appendChild(tabBar);
  }

  // ==================== SCROLLABLE CONTENT ====================
  const contentWrapper = document.createElement('div');
  contentWrapper.style.cssText = 'flex: 1; overflow-y: auto; min-height: 0;';

  // --- Panel A: Redacted tab ---
  // Show redacted panel by default when: tabs visible (default tab) OR block-only (no original tab)
  const showRedactedByDefault = showTabs || (hasRedactedContent && hasBlockOnly);
  const panelRedacted = document.createElement('div');
  panelRedacted.style.cssText = `padding: 16px 20px; display: ${showRedactedByDefault ? 'block' : 'none'};`;

  if (hasRedactedContent) {
    // Redacted text preview
    if (redactedText) {
      const previewBox = document.createElement('div');
      previewBox.style.cssText = `
        padding: 12px;
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        font-size: 13px;
        color: #166534;
        max-height: 150px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "Courier New", monospace;
      `;
      previewBox.textContent = redactedText.substring(0, 500) + (redactedText.length > 500 ? '...' : '');
      panelRedacted.appendChild(previewBox);
    }

    // Token legend (compact)
    if (tokenMap && Object.keys(tokenMap).length > 0) {
      const legendSection = document.createElement('div');
      legendSection.style.cssText = `
        margin-top: 10px;
        padding: 8px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      `;

      const legendLabel = document.createElement('p');
      legendLabel.style.cssText = 'margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: #475569;';
      legendLabel.textContent = 'Token Legend:';
      legendSection.appendChild(legendLabel);

      const legendTable = document.createElement('div');
      legendTable.style.cssText = 'display: flex; flex-direction: column; gap: 3px;';

      for (const [token, info] of Object.entries(tokenMap)) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 11px;';

        const tokenSpan = document.createElement('code');
        tokenSpan.style.cssText = `
          padding: 1px 5px; background: #e0e7ff; border-radius: 3px;
          font-family: "Courier New", monospace; color: #3730a3; font-size: 10px;
          white-space: nowrap;
        `;
        tokenSpan.textContent = token;

        const arrow = document.createElement('span');
        arrow.style.cssText = 'color: #94a3b8;';
        arrow.textContent = '\u2192';

        const infoSpan = document.createElement('span');
        infoSpan.style.cssText = 'color: #64748b;';
        const typeLabel = info.type.replace(/_/g, ' ');
        infoSpan.textContent = `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} (${info.preview})`;

        row.appendChild(tokenSpan);
        row.appendChild(arrow);
        row.appendChild(infoSpan);
        legendTable.appendChild(row);
      }

      legendSection.appendChild(legendTable);
      panelRedacted.appendChild(legendSection);
    }

    // File info in redacted tab
    if (hasFileViolations) {
      fileViolations!.forEach((fv) => {
        const fileNote = document.createElement('p');
        fileNote.style.cssText = 'margin: 12px 0 4px 0; font-size: 12px; font-weight: 500; color: #374151;';
        fileNote.textContent = `File: ${fv.filename}`;
        panelRedacted.appendChild(fileNote);

        if (fv.redactedDocument) {
          const note = document.createElement('p');
          note.style.cssText = 'margin: 0; font-size: 11px; color: #6b7280;';
          note.textContent = 'Redacted version of this document will be uploaded.';
          panelRedacted.appendChild(note);
        }

        panelRedacted.appendChild(createCompactDetectionList(fv.detections));
      });
    }

    // Compact detection list for message detections
    if (detections.length > 0) {
      panelRedacted.appendChild(createCompactDetectionList(detections));
    }
  }

  // --- Panel B: Original tab ---
  // Hide original panel when block-only (no override allowed) or when tabs are shown (default to redacted)
  const showOriginalByDefault = !showRedactedByDefault && !hasBlockOnly;
  const panelOriginal = document.createElement('div');
  panelOriginal.style.cssText = `padding: 16px 20px; display: ${showOriginalByDefault ? 'block' : 'none'};`;

  // Original text with highlighted PII
  if (detections.length > 0 && messageText) {
    const origLabel = document.createElement('p');
    origLabel.style.cssText = 'margin: 0 0 8px 0; font-size: 12px; font-weight: 500; color: #6b7280;';
    origLabel.textContent = 'Original message with PII highlighted:';
    panelOriginal.appendChild(origLabel);

    panelOriginal.appendChild(createHighlightedText(messageText, detections));
  }

  // File detections in original tab
  if (hasFileViolations) {
    fileViolations!.forEach((fv) => {
      const fileNote = document.createElement('p');
      fileNote.style.cssText = 'margin: 12px 0 4px 0; font-size: 12px; font-weight: 500; color: #374151;';
      fileNote.textContent = `File: ${fv.filename}`;
      panelOriginal.appendChild(fileNote);
      panelOriginal.appendChild(createCompactDetectionList(fv.detections));
    });
  }

  // Compact detection list for message
  if (detections.length > 0) {
    panelOriginal.appendChild(createCompactDetectionList(detections));
  }

  // Reason chips — only in Original tab
  if (canSendAnyway) {
    const overrideSection = document.createElement('div');
    overrideSection.style.cssText = 'margin: 16px 0 0 0; padding: 12px; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px;';

    const overrideLabel = document.createElement('p');
    overrideLabel.style.cssText = 'margin: 0 0 8px 0; font-size: 12px; font-weight: 500; color: #854d0e;';
    overrideLabel.innerHTML = `Why are you sending this data? <span style="font-weight: 400; font-size: 11px; color: #a16207;">(${requiresReason ? 'Required' : 'Optional'})</span>`;
    overrideSection.appendChild(overrideLabel);

    const reasons = overrideConfig?.predefined_reasons || ['False detection', 'Test/dummy data', 'Already public info', 'Other'];
    const categoryMap: Record<string, string> = {
      'False detection': 'false_detection',
      'Test/dummy data': 'test_data',
      'Already public info': 'public_info',
      'Other': 'other',
    };

    const chipsContainer = document.createElement('div');
    chipsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';

    const chipButtons: HTMLButtonElement[] = [];

    reasons.forEach((reason) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = reason;
      chip.style.cssText = `
        padding: 5px 12px; border: 1px solid #fde68a; border-radius: 20px;
        background: white; color: #854d0e; font-size: 11px; font-weight: 500;
        cursor: pointer; transition: all 0.15s ease;
      `;
      chip.addEventListener('click', () => {
        chipButtons.forEach(b => {
          b.style.background = 'white';
          b.style.borderColor = '#fde68a';
          b.style.color = '#854d0e';
        });
        chip.style.background = '#fef3c7';
        chip.style.borderColor = '#f59e0b';
        chip.style.color = '#92400e';
        selectedReasonCategory = categoryMap[reason] || reason.toLowerCase().replace(/\s+/g, '_');

        if (reason === 'Other') {
          if (!customReasonInput) {
            customReasonInput = document.createElement('input');
            customReasonInput.type = 'text';
            customReasonInput.placeholder = 'Please specify your reason...';
            customReasonInput.maxLength = 500;
            customReasonInput.style.cssText = `
              width: 100%; padding: 6px 10px; border: 1px solid #fde68a;
              border-radius: 6px; font-size: 12px; box-sizing: border-box; margin-top: 8px;
            `;
            overrideSection.appendChild(customReasonInput);
          }
          customReasonInput.style.display = 'block';
          customReasonInput.focus();
        } else if (customReasonInput) {
          customReasonInput.style.display = 'none';
        }

        // Enable primary button on Original tab
        if (primaryBtn && activeTab === 'original') {
          primaryBtn.disabled = false;
          primaryBtn.style.opacity = '1';
          primaryBtn.style.cursor = 'pointer';
        }
      });
      chipButtons.push(chip);
      chipsContainer.appendChild(chip);
    });

    overrideSection.appendChild(chipsContainer);
    panelOriginal.appendChild(overrideSection);
  }

  contentWrapper.appendChild(panelRedacted);
  contentWrapper.appendChild(panelOriginal);
  dialog.appendChild(contentWrapper);

  // ==================== BUTTON BAR (fixed) ====================
  const buttonBar = document.createElement('div');
  buttonBar.style.cssText = `
    flex-shrink: 0;
    padding: 12px 20px;
    border-top: 1px solid #e5e7eb;
    background: white;
  `;

  // Primary button
  const primaryBtn = document.createElement('button');
  primaryBtn.type = 'button';
  primaryBtn.setAttribute('data-action', activeTab === 'redacted' ? 'send-redacted' : 'send-anyway');

  const updatePrimaryButton = () => {
    if (activeTab === 'redacted') {
      primaryBtn.setAttribute('data-action', 'send-redacted');
      primaryBtn.disabled = false;
      primaryBtn.style.cssText = `
        width: 100%; padding: 10px 16px; background: #16a34a; color: white;
        border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
        cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      `;
      const label = hasFileViolations ? 'Upload Redacted Version' : 'Send Redacted Message';
      primaryBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <span>${label}</span>
      `;
    } else {
      // Original tab
      if (canSendAnyway) {
        primaryBtn.setAttribute('data-action', 'send-anyway');
        const isDisabled = !!requiresReason && !selectedReasonCategory;
        primaryBtn.disabled = isDisabled;
        const label = hasFileViolations ? 'Upload Original File' : 'Send Original Message';
        primaryBtn.style.cssText = `
          width: 100%; padding: 10px 16px; background: #dc2626; color: white;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
          cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
          opacity: ${isDisabled ? '0.5' : '1'};
          display: flex; align-items: center; justify-content: center; gap: 8px;
        `;
        primaryBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>${label}</span>
        `;
      } else {
        // Can't send anyway — hide primary or show disabled
        primaryBtn.setAttribute('data-action', 'send-anyway');
        primaryBtn.disabled = true;
        const label = hasFileViolations ? 'Upload Original File' : 'Send Original Message';
        primaryBtn.style.cssText = `
          width: 100%; padding: 10px 16px; background: #dc2626; color: white;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
          cursor: not-allowed; opacity: 0.35;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        `;
        primaryBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>${label} (Blocked)</span>
        `;
      }
    }
  };

  // Primary button click handler
  primaryBtn.addEventListener('click', () => {
    if (primaryBtn.disabled) return;

    if (activeTab === 'redacted') {
      onChoice('send-redacted');
    } else {
      // Original tab — send-anyway flow
      if (requiresReason && !selectedReasonCategory) return;

      const customText = (selectedReasonCategory === 'other' && customReasonInput)
        ? customReasonInput.value.trim()
        : undefined;

      if (requiresReason && selectedReasonCategory === 'other' && !customText) {
        if (customReasonInput) {
          customReasonInput.style.borderColor = '#dc2626';
          customReasonInput.focus();
        }
        return;
      }

      onChoice({
        choice: 'send-anyway',
        overrideReasonCategory: selectedReasonCategory || undefined,
        reason: customText,
        overriddenDetections: overridableDetections,
      });
    }
  });
  addHoverEffect(primaryBtn);

  updatePrimaryButton();
  buttonBar.appendChild(primaryBtn);

  // Secondary buttons row
  const secondaryRow = document.createElement('div');
  secondaryRow.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';

  // Edit button — only if message detections exist
  if (detections.length > 0) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.setAttribute('data-action', 'edit');
    editBtn.style.cssText = `
      flex: 1; padding: 8px 12px;
      background: white; color: #374151;
      border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    `;
    editBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      <span>Edit</span>
    `;
    editBtn.addEventListener('click', () => onChoice('edit'));
    addHoverEffect(editBtn);
    secondaryRow.appendChild(editBtn);
  }

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.setAttribute('data-action', 'cancel');
  cancelBtn.style.cssText = `
    flex: 1; padding: 8px 12px;
    background: white; color: #6b7280;
    border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 13px; font-weight: 500; cursor: pointer;
  `;
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => onChoice('cancel'));
  addHoverEffect(cancelBtn);
  secondaryRow.appendChild(cancelBtn);

  buttonBar.appendChild(secondaryRow);

  // Footer text
  const footerText = document.createElement('p');
  footerText.style.cssText = 'margin: 8px 0 0 0; font-size: 10px; color: #9ca3af; text-align: center;';
  footerText.innerHTML = 'Protected by <strong>Niyantra</strong>';
  buttonBar.appendChild(footerText);

  dialog.appendChild(buttonBar);

  // ==================== TAB SWITCHING LOGIC ====================
  const switchTab = (tab: 'redacted' | 'original') => {
    activeTab = tab;

    if (redactedTabBtn && originalTabBtn) {
      const setActive = (btn: HTMLButtonElement, active: boolean) => {
        btn.style.fontWeight = active ? '600' : '400';
        btn.style.color = active ? '#111827' : '#6b7280';
        btn.style.borderBottomColor = active ? '#6366f1' : 'transparent';
      };
      setActive(redactedTabBtn, tab === 'redacted');
      setActive(originalTabBtn, tab === 'original');
    }

    panelRedacted.style.display = tab === 'redacted' ? 'block' : 'none';
    panelOriginal.style.display = tab === 'original' ? 'block' : 'none';

    updatePrimaryButton();
  };

  if (redactedTabBtn) {
    redactedTabBtn.addEventListener('click', () => switchTab('redacted'));
  }
  if (originalTabBtn) {
    originalTabBtn.addEventListener('click', () => switchTab('original'));
  }

  return dialog;
}

/**
 * Add hover effect to button
 */
function addHoverEffect(button: HTMLButtonElement): void {
  button.addEventListener('mouseenter', () => {
    if (button.disabled) return;
    button.style.opacity = '0.9';
    button.style.transform = 'translateY(-1px)';
  });
  button.addEventListener('mouseleave', () => {
    if (button.disabled) return;
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
  return createCompactDetectionList([detection]);
}

export { createSecretItemElement };
