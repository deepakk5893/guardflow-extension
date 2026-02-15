/**
 * Shadow AI Manager
 *
 * Manages the local Shadow AI site list, syncs with server,
 * and checks URLs against the list for blocking/warning.
 */

import { storageGet, storageSet } from '../utils/storage';

// ============== Types ==============

export interface ShadowAISite {
  domain: string;
  name: string;
  category: string;
  action: 'block' | 'warn' | 'log' | 'allow';
  risk_level: string;
  description?: string;
}

export interface ShadowAIList {
  version: string;
  updated_at: string;
  sites: ShadowAISite[];
  enabled: boolean;
}

interface ShadowAIStorage {
  shadowAIList: ShadowAIList | null;
  shadowAIVersion: string;
  shadowAILastSync: string;
}

// ============== Constants ==============

const STORAGE_KEYS = {
  LIST: 'shadowAIList',
  VERSION: 'shadowAIVersion',
  LAST_SYNC: 'shadowAILastSync',
};

// Note: Version check uses chrome.alarms with 5-minute intervals
const VERSION_CHECK_ALARM_NAME = 'niyantra-shadow-ai-version-check';

// ============== Manager Class ==============

class ShadowAIManager {
  private list: ShadowAIList | null = null;
  private domainMap: Map<string, ShadowAISite> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the manager - load from storage
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await storageGet([
        STORAGE_KEYS.LIST,
        STORAGE_KEYS.VERSION,
        STORAGE_KEYS.LAST_SYNC,
      ]) as ShadowAIStorage;

      if (stored.shadowAIList) {
        this.list = stored.shadowAIList;
        this.buildDomainMap();
        console.log('[Niyantra] Shadow AI list loaded from storage:', this.list.sites.length, 'sites');
      }

      // If no list or list is old, sync from server
      const lastSync = stored.shadowAILastSync ? new Date(stored.shadowAILastSync) : null;
      const hoursSinceSync = lastSync ? (Date.now() - lastSync.getTime()) / (1000 * 60 * 60) : 999;

      if (!this.list || hoursSinceSync > 24) {
        await this.syncList();
      }

      this.initialized = true;
    } catch (error) {
      console.error('[Niyantra] Failed to initialize Shadow AI manager:', error);
    }
  }

  /**
   * Build domain lookup map for fast URL checking
   */
  private buildDomainMap(): void {
    this.domainMap.clear();
    if (!this.list?.sites) return;

    for (const site of this.list.sites) {
      // Store by domain (lowercase)
      this.domainMap.set(site.domain.toLowerCase(), site);
    }
  }

  /**
   * Sync full list from server
   */
  async syncList(): Promise<void> {
    try {
      const settings = await storageGet(['serverUrl', 'apiKey']);

      if (!settings.serverUrl || !settings.apiKey) {
        console.log('[Niyantra] Shadow AI: Not configured, skipping sync');
        return;
      }

      const response = await fetch(`${settings.serverUrl}/api/v1/shadow-ai/list`, {
        headers: {
          'X-API-Key': settings.apiKey,
        },
      });

      if (!response.ok) {
        console.warn('[Niyantra] Shadow AI list sync failed:', response.status);
        return;
      }

      const data = await response.json();

      // Merge master_list with tenant_overrides to get effective sites
      const sites = this.mergeSitesWithOverrides(
        data.master_list || [],
        data.tenant_overrides || []
      );

      this.list = {
        version: data.version,
        updated_at: data.generated_at || new Date().toISOString(),
        sites: sites,
        enabled: true, // If we got a list, Shadow AI is enabled
      };

      this.buildDomainMap();

      // Save to storage
      await storageSet({
        [STORAGE_KEYS.LIST]: this.list,
        [STORAGE_KEYS.VERSION]: this.list.version,
        [STORAGE_KEYS.LAST_SYNC]: new Date().toISOString(),
      });

      console.log('[Niyantra] Shadow AI list synced:', this.list.sites.length, 'sites, version:', this.list.version);
    } catch (error) {
      console.error('[Niyantra] Shadow AI list sync error:', error);
    }
  }

  /**
   * Merge master list with tenant overrides to get effective sites
   */
  private mergeSitesWithOverrides(
    masterList: Array<{ domain: string; name: string; category: string; action: string; risk_level: string }>,
    overrides: Array<{ domain: string; action?: string; is_whitelisted?: boolean }>
  ): ShadowAISite[] {
    // Create override lookup map
    const overrideMap = new Map<string, { action?: string; is_whitelisted?: boolean }>();
    for (const override of overrides) {
      overrideMap.set(override.domain.toLowerCase(), override);
    }

    // Process master list with overrides
    const sites: ShadowAISite[] = [];

    for (const site of masterList) {
      const override = overrideMap.get(site.domain.toLowerCase());

      // Determine effective action
      let effectiveAction: 'block' | 'warn' | 'log' | 'allow' = site.action as 'block' | 'warn' | 'log' | 'allow';

      if (override) {
        if (override.is_whitelisted) {
          effectiveAction = 'allow';
        } else if (override.action) {
          effectiveAction = override.action as 'block' | 'warn' | 'log' | 'allow';
        }
      }

      sites.push({
        domain: site.domain,
        name: site.name,
        category: site.category,
        action: effectiveAction,
        risk_level: site.risk_level,
      });
    }

    return sites;
  }

  /**
   * Check version only (lightweight) - returns true if version changed
   */
  async checkVersion(): Promise<boolean> {
    try {
      const settings = await storageGet(['serverUrl', 'apiKey']);

      if (!settings.serverUrl || !settings.apiKey) {
        return false;
      }

      const response = await fetch(`${settings.serverUrl}/api/v1/shadow-ai/version`, {
        headers: {
          'X-API-Key': settings.apiKey,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const currentVersion = this.list?.version || 'v0';

      if (data.version !== currentVersion) {
        console.log('[Niyantra] Shadow AI version changed:', currentVersion, '->', data.version);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Niyantra] Shadow AI version check error:', error);
      return false;
    }
  }

  /**
   * Extract domain from URL
   * Handles www prefixes, subdomains, and paths
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname.toLowerCase();

      // Remove www. prefix
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }

      return hostname;
    } catch {
      return '';
    }
  }

  /**
   * Check if URL matches any Shadow AI site
   * Returns the matching site or null
   */
  checkUrl(url: string): ShadowAISite | null {
    if (!this.list?.enabled || !url) {
      return null;
    }

    const domain = this.extractDomain(url);
    if (!domain) {
      return null;
    }

    // Direct match
    let site = this.domainMap.get(domain);
    if (site) {
      return site;
    }

    // Check if URL path matches (for sites like huggingface.co/chat)
    try {
      const urlObj = new URL(url);

      // Check progressively shorter path combinations
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      for (let i = pathParts.length; i > 0; i--) {
        const testPath = domain + '/' + pathParts.slice(0, i).join('/');
        site = this.domainMap.get(testPath.toLowerCase());
        if (site) {
          return site;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    // Check subdomain variants (e.g., chat.openai.com should match chatgpt.com listing)
    const domainParts = domain.split('.');
    if (domainParts.length > 2) {
      // Try without first subdomain (e.g., chat.openai.com -> openai.com)
      const parentDomain = domainParts.slice(1).join('.');
      site = this.domainMap.get(parentDomain);
      if (site) {
        return site;
      }
    }

    return null;
  }

  /**
   * Log detection to server (async, fire-and-forget)
   * Only logs actual Shadow AI detections (block, warn, log)
   * Does NOT log 'allow' actions (whitelisted/supported sites)
   */
  async logDetection(domain: string, actionTaken: string): Promise<void> {
    try {
      // Don't log 'allow' actions - these are whitelisted or supported sites
      // The backend only accepts: 'block', 'warn', 'log'
      if (actionTaken === 'allow') {
        return;
      }

      const settings = await storageGet(['serverUrl', 'apiKey']);

      if (!settings.serverUrl || !settings.apiKey) {
        return;
      }

      // Fire and forget - don't await
      fetch(`${settings.serverUrl}/api/v1/shadow-ai/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey,
        },
        body: JSON.stringify({
          domain,
          action_taken: actionTaken,
          user_agent: navigator.userAgent,
        }),
      }).catch(error => {
        console.warn('[Niyantra] Shadow AI log failed:', error);
      });
    } catch (error) {
      console.warn('[Niyantra] Shadow AI log error:', error);
    }
  }

  /**
   * Start version polling using chrome.alarms
   */
  startVersionPolling(): void {
    // Create alarm for periodic version checks
    chrome.alarms.create(VERSION_CHECK_ALARM_NAME, {
      periodInMinutes: 5,
    });

    console.log('[Niyantra] Shadow AI version polling started1');
  }

  /**
   * Stop version polling
   */
  stopVersionPolling(): void {
    chrome.alarms.clear(VERSION_CHECK_ALARM_NAME);
    console.log('[Niyantra] Shadow AI version polling stopped');
  }

  /**
   * Handle alarm event - called from background script
   */
  async handleAlarm(alarmName: string): Promise<void> {
    if (alarmName !== VERSION_CHECK_ALARM_NAME) return;

    const versionChanged = await this.checkVersion();
    if (versionChanged) {
      await this.syncList();
    }
  }

  /**
   * Get current list (for popup display)
   */
  getList(): ShadowAIList | null {
    return this.list;
  }

  /**
   * Check if Shadow AI is enabled
   */
  isEnabled(): boolean {
    return this.list?.enabled ?? false;
  }

  /**
   * Get count of sites by action type
   */
  getStats(): { total: number; blocked: number; warned: number; logged: number } {
    if (!this.list?.sites) {
      return { total: 0, blocked: 0, warned: 0, logged: 0 };
    }

    const stats = {
      total: this.list.sites.length,
      blocked: 0,
      warned: 0,
      logged: 0,
    };

    for (const site of this.list.sites) {
      switch (site.action) {
        case 'block':
          stats.blocked++;
          break;
        case 'warn':
          stats.warned++;
          break;
        case 'log':
          stats.logged++;
          break;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const shadowAIManager = new ShadowAIManager();

// Export alarm name for background script
export { VERSION_CHECK_ALARM_NAME };
