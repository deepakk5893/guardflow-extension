/**
 * File Interceptor for AI Chat Platforms
 *
 * Intercepts file uploads (file input and drag & drop) and scans
 * them via the Niyantra server before allowing attachment.
 *
 * Supported file types:
 * - PDF documents
 * - Word documents (DOCX, DOC)
 * - Images (PNG, JPG, GIF, WEBP) - scanned via OCR
 * - Text files (TXT, CSV, JSON)
 * - Spreadsheets (XLSX, XLS)
 */

import { apiClient, type ScanFileResponse, type PIIDetection } from './api-client';
import { showScanningOverlay } from './dialog';

// ============== Types ==============

interface FileInterceptorConfig {
  platform: string;
  // Selector for file input elements
  fileInputSelector: string;
  // Selector for drop zones (where files can be dragged)
  dropZoneSelector: string;
}

interface FileValidation {
  valid: boolean;
  error?: string;
}

// ============== Constants ==============

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SUPPORTED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Images (will be OCR'd)
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Text
  'text/plain',
  'text/csv',
  'application/json',
];

// Platform-specific configurations
const PLATFORM_CONFIGS: Record<string, FileInterceptorConfig> = {
  chatgpt: {
    platform: 'chatgpt',
    fileInputSelector: 'input[type="file"]',
    dropZoneSelector: '[data-testid="composer"]',
  },
  claude: {
    platform: 'claude',
    fileInputSelector: 'input[type="file"]',
    dropZoneSelector: '[data-testid="composer-input-container"]',
  },
  gemini: {
    platform: 'gemini',
    fileInputSelector: 'input[type="file"]',
    dropZoneSelector: '.chat-input-container',
  },
  perplexity: {
    platform: 'perplexity',
    fileInputSelector: 'input[type="file"]',
    dropZoneSelector: '.composer',
  },
  grok: {
    platform: 'grok',
    fileInputSelector: 'input[type="file"]',
    dropZoneSelector: 'button[aria-label="Attach"]',
  },
};

// Track stats
const fileStats = {
  filesScanned: 0,
  filesBlocked: 0,
  filesAllowed: 0,
};

// ============== Helper Functions ==============

/**
 * Detect platform from current URL
 */
function detectPlatform(): string | null {
  const hostname = window.location.hostname;

  if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
    return 'chatgpt';
  }
  if (hostname.includes('claude.ai')) {
    return 'claude';
  }
  if (hostname.includes('gemini.google.com')) {
    return 'gemini';
  }
  if (hostname.includes('perplexity.ai')) {
    return 'perplexity';
  }
  if (hostname.includes('grok.com')) {
    return 'grok';
  }

  return null;
}

/**
 * Validate file before scanning
 */
function validateFile(file: File): FileValidation {
  // Check size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
    };
  }

  // Check type
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    // Allow file through if type not supported (don't block unknown types)
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Convert file to base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// Priority order for detection types (higher = more critical, shown first)
const DETECTION_PRIORITY: Record<string, number> = {
  // Highest priority - secrets that can cause immediate harm
  'aws_access_key': 100,
  'aws_secret_key': 100,
  'api_key': 95,
  'private_key': 95,
  'rsa_private_key': 95,
  'ssh_key': 95,
  'jwt_token': 90,
  'bearer_token': 90,
  'github_token': 90,
  'stripe_key': 90,
  'slack_token': 90,
  'google_api_key': 90,
  'azure_key': 90,
  'password': 85,
  'generic_secret': 80,

  // High priority - financial/identity
  'credit_card': 75,
  'debit_card': 75,
  'bank_account': 75,
  'aadhaar': 70,
  'pan_card': 70,
  'passport': 70,
  'ssn': 70,
  'driving_license': 70,
  'upi_id': 65,

  // Medium priority - personal info
  'email': 50,
  'phone': 50,
  'phone_number': 50,
  'ip_address': 45,
  'mac_address': 45,

  // Lower priority - general PII
  'address': 30,
  'date_of_birth': 30,
  'person_name': 25,
  'name': 25,
  'organization': 20,
  'location': 15,

  // Unknown/Other
  'unknown': 10,
};

/**
 * Get human-readable label for detection type
 */
function getDetectionLabel(type: string): string {
  const labels: Record<string, string> = {
    'aws_access_key': 'AWS Access Key',
    'aws_secret_key': 'AWS Secret Key',
    'api_key': 'API Key',
    'private_key': 'Private Key',
    'rsa_private_key': 'RSA Private Key',
    'ssh_key': 'SSH Key',
    'jwt_token': 'JWT Token',
    'bearer_token': 'Bearer Token',
    'github_token': 'GitHub Token',
    'stripe_key': 'Stripe Key',
    'slack_token': 'Slack Token',
    'google_api_key': 'Google API Key',
    'azure_key': 'Azure Key',
    'password': 'Password',
    'generic_secret': 'Secret',
    'credit_card': 'Credit Card',
    'debit_card': 'Debit Card',
    'bank_account': 'Bank Account',
    'aadhaar': 'Aadhaar Number',
    'pan_card': 'PAN Card',
    'passport': 'Passport',
    'ssn': 'Social Security Number',
    'driving_license': 'Driving License',
    'upi_id': 'UPI ID',
    'email': 'Email Address',
    'phone': 'Phone Number',
    'phone_number': 'Phone Number',
    'ip_address': 'IP Address',
    'mac_address': 'MAC Address',
    'address': 'Address',
    'date_of_birth': 'Date of Birth',
    'person_name': 'Person Name',
    'name': 'Name',
    'organization': 'Organization',
    'location': 'Location',
    'unknown': 'Sensitive Data',
  };

  const lowerType = type.toLowerCase();
  return labels[lowerType] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Sort detections by priority (most critical first)
 */
function sortDetectionsByPriority(detections: PIIDetection[]): PIIDetection[] {
  return [...detections].sort((a, b) => {
    const priorityA = DETECTION_PRIORITY[a.type.toLowerCase()] || 10;
    const priorityB = DETECTION_PRIORITY[b.type.toLowerCase()] || 10;
    return priorityB - priorityA; // Higher priority first
  });
}

/**
 * Convert base64 to File object
 */
function base64ToFile(base64: string, filename: string, mimeType: string): File {
  // Decode base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create blob and file
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * Show dialog when files are blocked due to PII/secrets
 * Returns 'cancel' to block all, 'upload-redacted' to use redacted version, or 'remove-blocked' to continue with allowed files only
 */
async function showFileBlockedDialog(
  blockedFiles: { file: File; detections: PIIDetection[]; redactedDocument?: string }[]
): Promise<{ action: 'cancel' | 'upload-redacted' | 'remove-blocked'; redactedFiles?: File[] }> {
  // Check if any files have redacted versions available
  const hasRedactedVersions = blockedFiles.some(f => f.redactedDocument);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 520px;
      width: 90%;
      max-height: 90vh;
      overflow: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 16px;';
    header.innerHTML = `
      <div style="width: 44px; height: 44px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div>
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #991b1b;">Sensitive Data Detected</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #b91c1c;">${blockedFiles.length} file${blockedFiles.length > 1 ? 's' : ''} contain${blockedFiles.length === 1 ? 's' : ''} sensitive information</p>
      </div>
    `;
    dialog.appendChild(header);

    // File list with sorted detections
    const fileList = document.createElement('div');
    fileList.style.cssText = 'margin-bottom: 20px; max-height: 250px; overflow-y: auto;';

    blockedFiles.forEach(({ file, detections, redactedDocument }) => {
      const fileItem = document.createElement('div');
      fileItem.style.cssText = 'background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 8px;';

      const fileHeader = document.createElement('div');
      fileHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;';

      const fileName = document.createElement('p');
      fileName.style.cssText = 'margin: 0; font-weight: 500; color: #991b1b; font-size: 14px;';
      fileName.textContent = `📄 ${file.name}`;
      fileHeader.appendChild(fileName);

      if (redactedDocument) {
        const badge = document.createElement('span');
        badge.style.cssText = 'background: #dcfce7; color: #166534; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 500;';
        badge.textContent = '✓ Redacted version available';
        fileHeader.appendChild(badge);
      }

      fileItem.appendChild(fileHeader);

      // Sort detections by priority and show top 5
      const sortedDetections = sortDetectionsByPriority(detections);

      sortedDetections.slice(0, 5).forEach((detection) => {
        const detectionEl = document.createElement('div');
        detectionEl.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 12px; color: #7f1d1d; margin-top: 4px;';

        const typeLabel = getDetectionLabel(detection.type);
        const priority = DETECTION_PRIORITY[detection.type.toLowerCase()] || 10;

        // Color code by priority
        let bgColor = '#fecaca'; // Default red
        if (priority >= 90) {
          bgColor = '#dc2626'; // Critical - dark red
        } else if (priority >= 70) {
          bgColor = '#ef4444'; // High - red
        } else if (priority >= 50) {
          bgColor = '#f97316'; // Medium - orange
        } else {
          bgColor = '#fbbf24'; // Low - yellow
        }

        const textColor = priority >= 70 ? 'white' : '#7f1d1d';

        detectionEl.innerHTML = `
          <span style="background: ${bgColor}; color: ${textColor}; padding: 2px 8px; border-radius: 4px; font-weight: 500; font-size: 11px;">${typeLabel}</span>
          <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #7f1d1d; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${detection.preview || '***'}</code>
        `;
        fileItem.appendChild(detectionEl);
      });

      if (detections.length > 5) {
        const more = document.createElement('p');
        more.style.cssText = 'margin: 8px 0 0 0; font-size: 11px; color: #b91c1c;';
        more.textContent = `+ ${detections.length - 5} more items detected`;
        fileItem.appendChild(more);
      }

      fileList.appendChild(fileItem);
    });
    dialog.appendChild(fileList);

    // Warning/Info message
    const infoBox = document.createElement('div');
    if (hasRedactedVersions) {
      infoBox.style.cssText = 'background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 20px;';
      infoBox.innerHTML = `
        <p style="margin: 0; font-size: 13px; color: #166534;">
          <strong>✓ Redacted version available</strong><br/>
          <span style="font-size: 12px;">You can upload a redacted version of this file with sensitive data automatically removed.</span>
        </p>
      `;
    } else {
      infoBox.style.cssText = 'background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px;';
      infoBox.innerHTML = `
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          <strong>Cannot upload this file</strong><br/>
          <span style="font-size: 12px;">It contains sensitive information that could be exposed to the AI service.</span>
        </p>
      `;
    }
    dialog.appendChild(infoBox);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    // Upload Redacted button (if available)
    if (hasRedactedVersions) {
      const redactedButton = document.createElement('button');
      redactedButton.style.cssText = `
        width: 100%; padding: 12px 16px; background: #16a34a; color: white;
        border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
      `;
      redactedButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>Upload Redacted Version</span>
      `;
      redactedButton.addEventListener('mouseenter', () => {
        redactedButton.style.background = '#15803d';
      });
      redactedButton.addEventListener('mouseleave', () => {
        redactedButton.style.background = '#16a34a';
      });
      redactedButton.addEventListener('click', () => {
        // Create redacted files
        const redactedFiles: File[] = [];
        blockedFiles.forEach(({ file, redactedDocument }) => {
          if (redactedDocument) {
            // Create a new file from the redacted document
            const redactedFile = base64ToFile(
              redactedDocument,
              file.name.replace(/(\.[^.]+)$/, '_redacted$1'),
              file.type
            );
            redactedFiles.push(redactedFile);
          }
        });
        document.body.removeChild(overlay);
        resolve({ action: 'upload-redacted', redactedFiles });
      });
      buttonContainer.appendChild(redactedButton);
    }

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.style.cssText = `
      width: 100%; padding: 12px 16px; background: ${hasRedactedVersions ? '#f3f4f6' : '#dc2626'};
      color: ${hasRedactedVersions ? '#374151' : 'white'};
      border: ${hasRedactedVersions ? '1px solid #d1d5db' : 'none'};
      border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
    `;
    cancelButton.textContent = 'Cancel Upload';
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = hasRedactedVersions ? '#e5e7eb' : '#b91c1c';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = hasRedactedVersions ? '#f3f4f6' : '#dc2626';
    });
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve({ action: 'cancel' });
    });
    buttonContainer.appendChild(cancelButton);

    dialog.appendChild(buttonContainer);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;';
    footer.innerHTML = `
      <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">
        Protected by <strong>Niyantra</strong> - Enterprise AI Governance
      </p>
    `;
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

/**
 * Show error alert
 */
function showFileError(message: string): void {
  // Create a simple error overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 12px;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  `;

  dialog.innerHTML = `
    <div style="width: 48px; height: 48px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    </div>
    <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #111827;">File Upload Blocked</h3>
    <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">${message}</p>
    <button style="padding: 10px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">OK</button>
  `;

  const button = dialog.querySelector('button')!;
  button.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

// ============== File Scanning ==============

/**
 * Scan a file via the server
 * Returns the scan result - caller is responsible for showing dialogs
 */
async function scanFile(
  file: File,
  platform: string,
): Promise<{ allowed: boolean; response?: ScanFileResponse; error?: string }> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    return { allowed: false, error: validation.error };
  }

  // Skip scanning if server not configured or file type not supported
  if (!apiClient.isConfigured() || !SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { allowed: true };
  }

  // Initialize API client if needed
  if (!apiClient.isInitialized()) {
    await apiClient.initialize();
  }

  // Check max file size from server config
  const maxSize = apiClient.getMaxFileSizeBytes();
  if (file.size > maxSize) {
    return { allowed: false, error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB.` };
  }

  // Check if file type is supported
  if (!apiClient.isFileTypeSupported(file.type)) {
    // Allow unsupported types through
    return { allowed: true };
  }

  fileStats.filesScanned++;

  // Show scanning overlay
  const removeOverlay = showScanningOverlay();

  try {
    // Convert file to base64
    const base64Data = await fileToBase64(file);

    // Call server API
    const response = await apiClient.scanFile(base64Data, file.type, file.name, platform);

    removeOverlay();

    // Return result - let caller handle the dialog
    if (response.has_violations && response.should_block) {
      return { allowed: false, response };
    }

    return { allowed: true, response };
  } catch (error) {
    removeOverlay();
    console.error('[Niyantra] File scan error:', error);

    // On error, allow file (fail open)
    return { allowed: true };
  }
}

// ============== Interception Logic ==============

// Track files that have been approved (redacted versions) - skip scanning these
// Key: filename, Value: file size (to identify redacted files)
const approvedFiles = new Set<string>();

/**
 * Generate a unique key for a file to track it
 */
function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Mark files as approved (won't be scanned again)
 */
function markFilesAsApproved(files: File[]): void {
  files.forEach(f => approvedFiles.add(getFileKey(f)));
}

/**
 * Check if a file is approved (already scanned/redacted)
 */
function isFileApproved(file: File): boolean {
  return approvedFiles.has(getFileKey(file));
}

/**
 * Clear approval for a file (after it's uploaded)
 */
function clearFileApproval(file: File): void {
  approvedFiles.delete(getFileKey(file));
}

/**
 * Intercept file input change events
 * MUST scan immediately because ChatGPT uploads files as soon as they're selected
 */
async function interceptFileInput(
  input: HTMLInputElement,
  platform: string,
): Promise<void> {
  // Track if we're currently processing to prevent loops
  let isProcessing = false;

  input.addEventListener(
    'change',
    async (event) => {
      // Prevent processing if we triggered this event ourselves
      if (isProcessing) return;

      const files = input.files;
      if (!files || files.length === 0) return;

      // Check if ALL files are already approved (redacted versions we added)
      const allApproved = Array.from(files).every(f => isFileApproved(f));
      if (allApproved) {
        console.log('[Niyantra] All files already approved, allowing through');
        // Clear approvals after use
        Array.from(files).forEach(f => clearFileApproval(f));
        // Don't stop the event - let it proceed to ChatGPT
        return;
      }

      // CRITICAL: Stop the event immediately to prevent ChatGPT from uploading
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      isProcessing = true;

      const allowedFiles: File[] = [];
      const blockedFiles: { file: File; detections: PIIDetection[]; redactedDocument?: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip scanning if file is already approved
        if (isFileApproved(file)) {
          console.log('[Niyantra] File already approved, skipping scan:', file.name);
          allowedFiles.push(file);
          clearFileApproval(file);
          continue;
        }

        // Scan the file for PII/secrets
        try {
          const result = await scanFile(file, platform);

          if (result.allowed) {
            allowedFiles.push(file);
          } else if (result.error) {
            // Validation error (size, type, etc.)
            showFileError(result.error);
            input.value = '';
            isProcessing = false;
            return;
          } else if (result.response && result.response.detections) {
            // PII/secrets detected - include redacted document if available
            blockedFiles.push({
              file,
              detections: result.response.detections,
              redactedDocument: result.response.redacted_document,
            });
          }
        } catch (error) {
          console.warn('[Niyantra] File scan failed, allowing file:', file.name, error);
          allowedFiles.push(file); // Fail open - allow file if scan fails
        }
      }

      // If there are blocked files, show dialog
      if (blockedFiles.length > 0) {
        const dialogResult = await showFileBlockedDialog(blockedFiles);

        if (dialogResult.action === 'cancel') {
          // User cancelled - clear all files
          input.value = '';
          fileStats.filesBlocked += blockedFiles.length;
          isProcessing = false;
          return;
        } else if (dialogResult.action === 'upload-redacted' && dialogResult.redactedFiles) {
          // User chose to upload redacted versions - mark them as approved
          markFilesAsApproved(dialogResult.redactedFiles);
          allowedFiles.push(...dialogResult.redactedFiles);
          fileStats.filesAllowed += dialogResult.redactedFiles.length;
        }
        // If "remove-blocked" - we continue with only allowed files
      }

      // Clear the input first
      input.value = '';

      // If we have allowed files, re-add them
      if (allowedFiles.length > 0) {
        const dt = new DataTransfer();
        allowedFiles.forEach((f) => dt.items.add(f));
        input.files = dt.files;

        fileStats.filesAllowed += allowedFiles.length;

        // Dispatch a new change event for the allowed files
        isProcessing = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        isProcessing = false;
      }
    },
    true, // Capture phase - intercept before ChatGPT's handlers
  );
}

/**
 * Intercept drag & drop file uploads
 * MUST scan immediately because ChatGPT uploads files as soon as they're dropped
 */
function interceptDragDrop(
  dropZone: HTMLElement,
  platform: string,
): void {
  let isProcessing = false;

  dropZone.addEventListener(
    'drop',
    async (event) => {
      if (isProcessing) return;

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(dataTransfer.files);

      // Check if ALL files are already approved (redacted versions we added)
      const allApproved = files.every(f => isFileApproved(f));
      if (allApproved) {
        console.log('[Niyantra] All dropped files already approved, allowing through');
        // Clear approvals after use
        files.forEach(f => clearFileApproval(f));
        // Don't stop the event - let it proceed to ChatGPT
        return;
      }

      // CRITICAL: Stop the event immediately to prevent ChatGPT from uploading
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      isProcessing = true;

      const allowedFiles: File[] = [];
      const blockedFiles: { file: File; detections: PIIDetection[]; redactedDocument?: string }[] = [];

      for (const file of files) {
        // Skip scanning if file is already approved
        if (isFileApproved(file)) {
          console.log('[Niyantra] Dropped file already approved, skipping scan:', file.name);
          allowedFiles.push(file);
          clearFileApproval(file);
          continue;
        }

        // Scan the file for PII/secrets (scanFile handles validation too)
        try {
          const result = await scanFile(file, platform);

          if (result.allowed) {
            allowedFiles.push(file);
          } else if (result.error) {
            // Validation error (size, type, etc.)
            showFileError(result.error);
            isProcessing = false;
            return;
          } else if (result.response && result.response.detections) {
            // PII/secrets detected - include redacted document if available
            blockedFiles.push({
              file,
              detections: result.response.detections,
              redactedDocument: result.response.redacted_document,
            });
          }
        } catch (error) {
          console.warn('[Niyantra] File scan failed, allowing file:', file.name, error);
          allowedFiles.push(file); // Fail open
        }
      }

      // If there are blocked files, show dialog
      if (blockedFiles.length > 0) {
        const dialogResult = await showFileBlockedDialog(blockedFiles);

        if (dialogResult.action === 'cancel') {
          fileStats.filesBlocked += blockedFiles.length;
          isProcessing = false;
          return;
        } else if (dialogResult.action === 'upload-redacted' && dialogResult.redactedFiles) {
          // User chose to upload redacted versions - mark them as approved
          markFilesAsApproved(dialogResult.redactedFiles);
          allowedFiles.push(...dialogResult.redactedFiles);
          fileStats.filesAllowed += dialogResult.redactedFiles.length;
        }
      }

      // If we have allowed files, create a new drop event for them
      if (allowedFiles.length > 0) {
        const newDataTransfer = new DataTransfer();
        allowedFiles.forEach((f) => newDataTransfer.items.add(f));

        fileStats.filesAllowed += allowedFiles.length;

        isProcessing = false;

        // Dispatch new drop event with only allowed files
        const newEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: newDataTransfer,
        });
        dropZone.dispatchEvent(newEvent);
      } else {
        isProcessing = false;
      }
    },
    true, // Capture phase - intercept before ChatGPT's handlers
  );
}

// ============== Initialization ==============

/**
 * Initialize file interception for the current platform
 */
export function initFileInterceptor(): void {
  const platform = detectPlatform();

  if (!platform) {
    console.log('[Niyantra] Unknown platform, file interception disabled');
    return;
  }

  const config = PLATFORM_CONFIGS[platform];
  if (!config) {
    console.log('[Niyantra] No config for platform:', platform);
    return;
  }

  console.log('[Niyantra] Initializing file interceptor for', platform);

  // Use MutationObserver to handle dynamically added file inputs
  const observer = new MutationObserver(() => {
    // Find file inputs
    const fileInputs = document.querySelectorAll(
      `${config.fileInputSelector}:not([data-niyantra-intercepted])`,
    );

    fileInputs.forEach((input) => {
      input.setAttribute('data-niyantra-intercepted', 'true');
      interceptFileInput(input as HTMLInputElement, platform);
      console.log('[Niyantra] File input intercepted');
    });

    // Find drop zones
    const dropZones = document.querySelectorAll(
      `${config.dropZoneSelector}:not([data-niyantra-drop-intercepted])`,
    );

    dropZones.forEach((zone) => {
      zone.setAttribute('data-niyantra-drop-intercepted', 'true');
      interceptDragDrop(zone as HTMLElement, platform);
      console.log('[Niyantra] Drop zone intercepted');
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also intercept existing elements
  const existingInputs = document.querySelectorAll(config.fileInputSelector);
  existingInputs.forEach((input) => {
    input.setAttribute('data-niyantra-intercepted', 'true');
    interceptFileInput(input as HTMLInputElement, platform);
  });

  const existingDropZones = document.querySelectorAll(config.dropZoneSelector);
  existingDropZones.forEach((zone) => {
    zone.setAttribute('data-niyantra-drop-intercepted', 'true');
    interceptDragDrop(zone as HTMLElement, platform);
  });
}

// Export stats for debugging
export const getFileStats = () => ({ ...fileStats });

/**
 * Get currently attached files from the page
 * Used to scan files when user clicks Send
 */
export async function getAttachedFiles(_config: any): Promise<File[]> {
  const platform = detectPlatform();
  if (!platform) return [];

  const platformConfig = PLATFORM_CONFIGS[platform];
  if (!platformConfig) return [];

  // Find file input elements
  const fileInputs = document.querySelectorAll(platformConfig.fileInputSelector);
  const allFiles: File[] = [];

  fileInputs.forEach((input) => {
    const htmlInput = input as HTMLInputElement;
    if (htmlInput.files && htmlInput.files.length > 0) {
      allFiles.push(...Array.from(htmlInput.files));
    }
  });

  return allFiles;
}

/**
 * Export scanFile function for use in content script
 */
export { scanFile };
