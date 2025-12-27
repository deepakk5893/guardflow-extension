/**
 * API Client for Niyantra server communication
 *
 * Handles all HTTP communication with the Niyantra backend for:
 * - Message scanning (PII/secret detection)
 * - File scanning (OCR + PII detection)
 * - Heartbeat monitoring
 * - Configuration sync
 */

// ============== Types ==============

export interface PIIDetection {
  type: string;
  category: 'hard' | 'soft';
  start: number;
  end: number;
  preview: string;
  severity: string;
  framework?: string;
  confidence: number;
  line_number?: number;
}

export interface RedactedSpan {
  start: number;
  end: number;
  replacement: string;
}

export interface ScanMessageResponse {
  has_violations: boolean;
  should_block: boolean;
  detections: PIIDetection[];
  redacted_text?: string;
  redacted_spans: RedactedSpan[];
  summary: Record<string, any>;
  scan_time_ms: number;
}

export interface ScanFileResponse {
  has_violations: boolean;
  should_block: boolean;
  detections: PIIDetection[];
  redacted_document?: string;  // Base64 encoded redacted file
  extracted_text?: string;
  summary: Record<string, any>;
  scan_time_ms: number;
}

export interface ExtensionConfig {
  config_version: string;
  scan_mode: 'local_only' | 'server_regex' | 'server_full';
  max_file_size_mb: number;
  supported_platforms: string[];
  supported_file_types: string[];
  block_on_server_error: boolean;
  heartbeat_interval_seconds: number;
  show_redacted_preview: boolean;
  allow_send_anyway: boolean;
  custom_blocked_message?: string;
  tenant_name?: string;
}

export interface ValidateKeyResponse {
  valid: boolean;
  user_email?: string;
  tenant_name?: string;
  expires_at?: string;
  scopes: string[];
}

export type ScanMode = 'local' | 'server' | 'hybrid';

// ============== Helpers ==============

/**
 * Check if the extension context is still valid
 * This can become invalid if the extension is reloaded but the page isn't
 */
function isExtensionContextValid(): boolean {
  try {
    // Try to access chrome.runtime.id - this will throw if context is invalid
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

// ============== API Client ==============

class NiyantraApiClient {
  private baseUrl: string = '';
  private apiKey: string = '';
  private config: ExtensionConfig | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the API client from stored settings
   */
  async initialize(): Promise<void> {
    try {
      const settings = await chrome.storage.local.get(['serverUrl', 'apiKey']);
      this.baseUrl = settings.serverUrl || '';
      this.apiKey = settings.apiKey || '';
      this.initialized = true;

      // Fetch config if we have credentials
      if (this.isConfigured()) {
        try {
          await this.fetchConfig();
        } catch (e) {
          console.warn('Failed to fetch config on init:', e);
        }
      }
    } catch (e) {
      console.error('Failed to initialize API client:', e);
    }
  }

  /**
   * Check if the client has server URL and API key configured
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current server URL
   */
  getServerUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update settings (called when user changes settings in popup)
   */
  async updateSettings(serverUrl: string, apiKey: string): Promise<void> {
    this.baseUrl = serverUrl;
    this.apiKey = apiKey;
    await chrome.storage.local.set({ serverUrl, apiKey });

    // Fetch new config
    if (this.isConfigured()) {
      await this.fetchConfig();
    }
  }

  /**
   * Validate an API key before saving
   */
  async validateKey(serverUrl: string, apiKey: string): Promise<ValidateKeyResponse> {
    const response = await fetch(`${serverUrl}/api/v1/extension/validate-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: apiKey }),
    });

    if (!response.ok) {
      throw new Error(`Validation failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Scan message text for PII/secrets
   * Uses background script to make HTTP request (avoids PNA restrictions)
   */
  async scanMessage(
    text: string,
    platform: string
  ): Promise<ScanMessageResponse> {
    if (!this.isConfigured()) {
      throw new Error('API client not configured');
    }

    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalidated. Please reload the page.');
    }

    // Send message to background script to make the HTTP request
    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/api/v1/extension/scan-message',
      method: 'POST',
      body: {
        text,
        platform,
        mode: 'server_full',
        include_redacted_text: true,
      },
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data;
  }

  /**
   * Scan file attachment for PII
   * Uses background script to make HTTP request (avoids PNA restrictions)
   */
  async scanFile(
    document: string,
    mimeType: string,
    filename: string,
    platform: string
  ): Promise<ScanFileResponse> {
    if (!this.isConfigured()) {
      throw new Error('API client not configured');
    }

    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalidated. Please reload the page.');
    }

    // Send message to background script to make the HTTP request
    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/api/v1/extension/scan-file',
      method: 'POST',
      body: {
        document,
        mime_type: mimeType,
        filename,
        platform,
        include_redacted_document: true,
      },
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data;
  }

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat(
    extensionVersion: string,
    browser: string,
    isEnabled: boolean,
    stats?: Record<string, number>
  ): Promise<void> {
    if (!this.isConfigured()) {
      return; // Silently skip if not configured
    }

    try {
      await fetch(`${this.baseUrl}/api/v1/extension/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          extension_version: extensionVersion,
          browser,
          is_enabled: isEnabled,
          last_scan_timestamp: new Date().toISOString(),
          stats,
        }),
      });
    } catch (e) {
      console.error('Heartbeat failed:', e);
    }
  }

  /**
   * Fetch configuration from server
   * Uses background script to make HTTP request (avoids PNA restrictions)
   */
  async fetchConfig(): Promise<ExtensionConfig> {
    if (!this.isConfigured()) {
      throw new Error('API client not configured');
    }

    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalidated. Please reload the page.');
    }

    // Send message to background script to make the HTTP request
    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/api/v1/extension/config',
      method: 'GET',
    });

    if (response.error) {
      throw new Error(response.error);
    }

    this.config = response.data;
    return this.config!;
  }

  /**
   * Get cached configuration
   */
  getConfig(): ExtensionConfig | null {
    return this.config;
  }

  /**
   * Get max file size in bytes
   */
  getMaxFileSizeBytes(): number {
    const maxMb = this.config?.max_file_size_mb || 10;
    return maxMb * 1024 * 1024;
  }

  /**
   * Check if a file type is supported
   */
  isFileTypeSupported(mimeType: string): boolean {
    if (!this.config?.supported_file_types) {
      // Default supported types
      return [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png', 'image/jpeg', 'image/gif', 'image/webp',
        'text/plain', 'text/csv', 'application/json',
      ].includes(mimeType);
    }
    return this.config.supported_file_types.includes(mimeType);
  }

  /**
   * Check if server health is ok (quick ping)
   */
  async healthCheck(): Promise<boolean> {
    if (!this.baseUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new NiyantraApiClient();
